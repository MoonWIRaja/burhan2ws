"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  IconArrowLeft,
  IconChecks,
  IconX,
  IconClock,
  IconUsers,
  IconAlertTriangle,
  IconRefresh,
  IconFilter,
} from "@tabler/icons-react";

interface Recipient {
  id: string;
  name: string | null;
  phoneNumber: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  errorMessage?: string;
  sentAt?: string;
}

interface CampaignDetail {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  message: string;
  mediaUrl?: string;
  mediaType?: string;
  recipients?: Recipient[];
}

export default function BlastReportPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/campaigns/${campaignId}`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to fetch report: ${res.status}`);
      }
      const data = await res.json();
      const campaignData = data.campaign || data;
      setCampaign(campaignData);
      setRecipients(data.recipients || campaignData?.recipients || []);
    } catch (err) {
      console.error("Failed to fetch report:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      fetchReport();
    }
  }, [campaignId]);

  // Auto-refresh if campaign is still running
  useEffect(() => {
    if (campaign?.status === "running" || campaign?.status === "pending") {
      const interval = setInterval(fetchReport, 3000);
      return () => clearInterval(interval);
    }
  }, [campaign?.status]);

  const filteredRecipients = recipients.filter((r) => {
    const matchesStatus = filterStatus === "all" || r.status === filterStatus;
    const matchesSearch =
      !searchQuery ||
      r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.phoneNumber.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  // Helper function for safe status display
  const formatStatus = (status: string | null | undefined) => {
    if (!status) return "Pending";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getStatusColor = (status: string | null | undefined) => {
    if (!status) return "bg-orange-500/10 text-orange-600";
    switch (status) {
      case "sent": return "bg-green-500/10 text-green-600";
      case "delivered": return "bg-blue-500/10 text-blue-600";
      case "read": return "bg-purple-500/10 text-purple-600";
      case "failed": return "bg-red-500/10 text-red-600";
      case "pending": return "bg-orange-500/10 text-orange-600";
      case "running": return "bg-blue-500/10 text-blue-600";
      case "completed": return "bg-green-500/10 text-green-600";
      case "partial": return "bg-yellow-500/10 text-yellow-600";
      case "scheduled": return "bg-purple-500/10 text-purple-600";
      default: return "bg-neutral-500/10 text-neutral-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
      case "read":
        return <IconChecks size={14} />;
      case "failed":
        return <IconX size={14} />;
      default:
        return <IconClock size={14} />;
    }
  };

  // Calculate stats from recipients
  const stats = [
    { label: "Total", value: recipients.length, icon: IconUsers, color: "bg-neutral-500/10 text-neutral-600" },
    { label: "Sent", value: recipients.filter(r => r.status === "sent" || r.status === "delivered" || r.status === "read").length, icon: IconChecks, color: "bg-green-500/10 text-green-600" },
    { label: "Delivered", value: recipients.filter(r => r.status === "delivered" || r.status === "read").length, icon: IconChecks, color: "bg-blue-500/10 text-blue-600" },
    { label: "Read", value: recipients.filter(r => r.status === "read").length, icon: IconChecks, color: "bg-purple-500/10 text-purple-600" },
    { label: "Failed", value: recipients.filter(r => r.status === "failed").length, icon: IconAlertTriangle, color: "bg-red-500/10 text-red-600" },
  ];

  if (loading && !campaign) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <IconAlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Failed to Load Report</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push("/blast")}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="shrink-0 bg-background border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/blast")}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <IconArrowLeft size={18} className="text-foreground" />
              </button>
              <div>
                <h1 className="text-base font-bold text-foreground">{campaign?.title || "Campaign Report"}</h1>
                <p className="text-xs text-muted-foreground">
                  Status:{" "}
                  <span className={getStatusColor(campaign?.status)}>
                    {formatStatus(campaign?.status)}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={fetchReport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              <IconRefresh size={14} className={loading ? "animate-spin" : ""} />
              <span className="text-xs font-medium">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 max-w-5xl mx-auto">
          {/* Error message */}
          {error && (
            <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <IconAlertTriangle size={16} className="text-red-500 shrink-0" />
              <span className="text-xs text-red-500">{error}</span>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            {stats.map((stat) => (
              <div key={stat.label} className={`p-3 rounded-xl border ${stat.color}`}>
                <stat.icon size={16} className="mb-1" />
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[9px] uppercase font-medium opacity-70">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Message Preview */}
          <div className="bg-card border border-border rounded-xl p-3 mb-4">
            <h2 className="text-xs font-bold mb-2 uppercase tracking-wide">Message Content</h2>
            <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-2.5 max-h-32 overflow-y-auto">
              {campaign?.message || "No message"}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <IconFilter size={14} className="text-muted-foreground" />
              <span className="text-xs font-medium">Filter:</span>
            </div>
            {["all", "pending", "sent", "delivered", "read", "failed"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === status
                    ? "bg-green-500 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ml-auto px-2 py-1 rounded-lg text-xs bg-muted border-none focus:ring-2 focus:ring-green-500 outline-none w-32"
            />
          </div>

          {/* Recipients Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-muted-foreground uppercase">Name</th>
                    <th className="px-3 py-2 text-left font-bold text-muted-foreground uppercase">Phone</th>
                    <th className="px-3 py-2 text-left font-bold text-muted-foreground uppercase">Status</th>
                    <th className="px-3 py-2 text-left font-bold text-muted-foreground uppercase">Error</th>
                    <th className="px-3 py-2 text-left font-bold text-muted-foreground uppercase">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        {recipients.length === 0 ? "No recipients for this campaign" : "No recipients match your filter"}
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((recipient) => (
                      <tr key={recipient.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{recipient.name || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{recipient.phoneNumber}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(recipient.status)}`}>
                            {getStatusIcon(recipient.status)}
                            {formatStatus(recipient.status)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-red-500 max-w-xs truncate text-[10px]">{recipient.errorMessage || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground text-[10px]">
                          {recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recipients count info */}
          <div className="mt-2 text-center">
            <p className="text-[10px] text-muted-foreground">
              Showing {filteredRecipients.length} of {recipients.length} recipients
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
