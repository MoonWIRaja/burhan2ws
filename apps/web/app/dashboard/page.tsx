"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { IconSend, IconCheck, IconX, IconRobot, IconLoader2, IconDownload, IconCalendar, IconCreditCard } from "@tabler/icons-react";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { addDays, format, isSameDay } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Helper functions to get start/end of day in LOCAL timezone (preserves the date)
function getStartOfDayLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDayLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

interface DashboardStats {
  totalSent: number;
  successCount: number;
  failedCount: number;
  botReplies: number;
  conversationsHandled: number;
  totalContacts: number;
  actualAiCost: number;  // Actual AI cost from database (RM)
}

interface RecentBlast {
  id: string;
  title: string;
  recipientCount: number;
  successCount: number;
  failedCount: number;
  status: string;
  scheduledAt: string;
}

interface AnalyticsData {
  date: string;
  sent: number;
  success: number;
  failed: number;
  botReplies: number;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBlasts, setRecentBlasts] = useState<RecentBlast[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: getStartOfDayLocal(new Date()),
    to: getEndOfDayLocal(new Date()),
  });

  // Use ref to always have access to latest dateRange
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;

  // Fetch dashboard data - using useCallback with proper dependencies
  const fetchDashboardData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);

      const currentRange = dateRangeRef.current;

      console.log(`[Dashboard] Current dateRange state:`, {
        from: currentRange.from?.toISOString(),
        to: currentRange.to?.toISOString(),
        fromFormatted: currentRange.from ? format(currentRange.from, 'yyyy-MM-dd HH:mm:ss') : 'N/A',
        toFormatted: currentRange.to ? format(currentRange.to, 'yyyy-MM-dd HH:mm:ss') : 'N/A'
      });

      // Send local date strings (YYYY-MM-DD) instead of ISO timestamps
      // This ensures the backend knows exactly which LOCAL day the user selected
      const params = new URLSearchParams();
      if (currentRange.from) {
        // Format as YYYY-MM-DD in local timezone
        const fromDateStr = format(currentRange.from, 'yyyy-MM-dd');
        params.append('from', fromDateStr);

        // If 'to' is undefined, use the same day (single day selection)
        const toDate = currentRange.to || currentRange.from;
        const toDateStr = format(toDate, 'yyyy-MM-dd');
        params.append('to', toDateStr);

        console.log(`[Dashboard] Sending local date strings: from=${fromDateStr}, to=${toDateStr}`);
      }

      console.log(`[Dashboard] API params:`, params.toString());
      console.log(`[Dashboard] Fetching URL: /api/dashboard/stats?${params.toString()}`);

      // Add cache-busting timestamp to prevent browser caching
      const cacheBuster = `&_t=${Date.now()}`;

      // Fetch stats
      const statsRes = await fetch(`/api/dashboard/stats?${params}${cacheBuster}`, {
        headers: {
          'Cookie': document.cookie,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      const statsData = await statsRes.json();

      // Fetch recent blasts
      const blastsRes = await fetch(`/api/dashboard/recent-blasts?${params}${cacheBuster}`, {
        headers: {
          'Cookie': document.cookie,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      const blastsData = await blastsRes.json();

      // Fetch analytics
      const analyticsRes = await fetch(`/api/dashboard/analytics?${params}${cacheBuster}`, {
        headers: {
          'Cookie': document.cookie,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      const analyticsData = await analyticsRes.json();

      console.log(`[Dashboard] API responses received:`, {
        stats: statsData,
        blastsCount: blastsData.blasts?.length || 0,
        analyticsCount: analyticsData.data?.length || 0
      });

      setStats(statsData);
      setRecentBlasts(blastsData.blasts || []);
      setAnalytics(analyticsData.data || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []); // Empty deps - we use ref instead

  // Initial fetch and auto-refresh
  useEffect(() => {
    // Initial fetch with loading
    fetchDashboardData(true);

    // Set up polling interval (silent refresh without loading spinner)
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 10000); // 10 seconds

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Refetch data immediately when date range changes
  useEffect(() => {
    fetchDashboardData(true);
  }, [dateRange, fetchDashboardData]);

  const downloadPDF = async () => {
    try {
      setDownloadingPDF(true);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;

      // 1. Header Section (Clean & Minimalist)
      doc.setFillColor(24, 24, 27); // Dark zinc header
      doc.rect(0, 0, pageWidth, 45, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text("Business Performance Report", margin, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(161, 161, 170); // Zinc 400
      const periodText = dateRange.from && dateRange.to
        ? `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`
        : 'All Time';
      doc.text(`REPORT PERIOD: ${periodText.toUpperCase()}`, margin, 32);
      doc.text(`GENERATED ON: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, margin, 38);

      // Section: Executive Summary (Card Grid)
      let yPos = 60;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("Executive Summary", margin, yPos);
      yPos += 10;

      // Card Helper Function
      const drawCard = (x: number, y: number, w: number, h: number, label: string, value: string, subValue?: string) => {
        doc.setDrawColor(228, 228, 231); // Zinc 200
        doc.setFillColor(255, 255, 255);
        doc.rect(x, y, w, h, 'FD'); // Filled and stroked

        doc.setTextColor(113, 113, 122); // Zinc 500
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(label.toUpperCase(), x + 5, y + 8);

        doc.setTextColor(24, 24, 27); // Zinc 950
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(value, x + 5, y + 20);

        if (subValue) {
          doc.setTextColor(22, 163, 74); // Green 600
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(subValue, x + 5, y + 28);
        }
      };

      const cardWidth = (pageWidth - (margin * 2) - 10) / 3;
      const cardHeight = 35;

      // Row 1
      drawCard(margin, yPos, cardWidth, cardHeight, "Total Sent", (stats?.totalSent || 0).toLocaleString());
      drawCard(margin + cardWidth + 5, yPos, cardWidth, cardHeight, "Success Rate", stats?.totalSent ? `${((stats.successCount / stats.totalSent) * 100).toFixed(1)}%` : "0%");
      drawCard(margin + (cardWidth * 2) + 10, yPos, cardWidth, cardHeight, "Total Contacts", (stats?.totalContacts || 0).toLocaleString());

      yPos += cardHeight + 10;

      // Section: AI & Bot Impact
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("AI & Financial ROI", margin, yPos);
      yPos += 10;

      // AI Cost Calculation (Actual from database)
      const totalAiCost = stats?.actualAiCost || 0;
      const humanSavings = totalAiCost * 5; // Estimating 5x cost if human handled

      drawCard(margin, yPos, cardWidth, cardHeight, "Bot Replies", (stats?.botReplies || 0).toLocaleString(), "Active Automation");
      drawCard(margin + cardWidth + 5, yPos, cardWidth, cardHeight, "AI Cost", `RM ${totalAiCost.toFixed(2)}`, "Actual API cost");
      drawCard(margin + (cardWidth * 2) + 10, yPos, cardWidth, cardHeight, "Human Savings", `RM ${humanSavings.toFixed(2)}`, "Cost Avoidance");

      yPos += cardHeight + 15;

      // Section: Detailed Campaign History
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("Campaign Performance Details", margin, yPos);
      yPos += 5;

      if (recentBlasts.length > 0) {
        const blastsData = recentBlasts.map(blast => [
          blast.title,
          blast.recipientCount.toLocaleString(),
          `${((blast.successCount / (blast.recipientCount || 1)) * 100).toFixed(1)}%`,
          blast.status.toUpperCase(),
          format(new Date(blast.scheduledAt), 'dd/MM/yyyy'),
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Campaign Name', 'Recipients', 'Success %', 'Status', 'Date']],
          body: blastsData,
          theme: 'grid',
          headStyles: { fillColor: [24, 24, 27], textColor: 255, fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8, textColor: [63, 63, 70] },
          margin: { left: margin, right: margin },
          styles: { cellPadding: 4 },
        });
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(113, 113, 122);
        doc.text(
          `Page ${i} of ${pageCount} | WhatsApp Blast AI Corporate Intelligence`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`whatsapp-blast-corporate-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const statCards = [
    {
      label: "Total Sent",
      value: stats?.totalSent?.toLocaleString() || "0",
      icon: <IconSend className="text-blue-500" />,
      color: "blue",
      sub: "Messages blasted"
    },
    {
      label: "Successful",
      value: stats?.successCount?.toLocaleString() || "0",
      icon: <IconCheck className="text-green-500" />,
      color: "green",
      sub: stats?.totalSent ? `${((stats.successCount / stats.totalSent) * 100).toFixed(1)}%` : "0%"
    },
    {
      label: "Failed",
      value: stats?.failedCount?.toLocaleString() || "0",
      icon: <IconX className="text-red-500" />,
      color: "red",
      sub: stats?.totalSent ? `${((stats.failedCount / stats.totalSent) * 100).toFixed(1)}%` : "0%"
    },
    {
      label: "Bot Replies",
      value: stats?.botReplies?.toLocaleString() || "0",
      icon: <IconRobot className="text-purple-500" />,
      color: "purple",
      sub: `Auto-replies sent`
    },
    {
      label: "AI Cost",
      value: `RM ${(stats?.actualAiCost || 0).toFixed(2)}`,
      icon: <IconCreditCard className="text-yellow-500" />,
      color: "yellow",
      sub: "Actual AI token cost"
    },
  ];

  const maxCount = Math.max(
    ...analytics.map(a => Math.max(a.sent, a.botReplies)),
    1
  );

  // Format date range display
  const getDateRangeDisplay = () => {
    if (!dateRange.from || !dateRange.to) return "All Time";
    if (isSameDay(dateRange.from, dateRange.to)) {
      return format(dateRange.from, 'MMM dd, yyyy');
    }
    return `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Dashboard</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Track your blast campaigns and bot performance.
            <span className="text-green-600 font-medium bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-md text-xs">
              {getDateRangeDisplay()}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DatePickerWithRange
            dateRange={dateRange}
            setDateRange={setDateRange}
          />
          <button
            onClick={downloadPDF}
            disabled={loading || downloadingPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloadingPDF ? (
              <>
                <IconLoader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <IconDownload className="w-4 h-4" />
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <IconLoader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map((stat, i) => (
              <div key={i} className={`p-6 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-${stat.color}-500/10 to-transparent rounded-bl-full -mr-4 -mt-4" />
                <div className="flex items-center mb-4 relative">
                  <div className={`p-3 bg-${stat.color}-500/10 rounded-xl`}>
                    {stat.icon}
                  </div>
                </div>
                <div className="space-y-1 relative">
                  <h3 className="text-3xl font-bold text-foreground">{stat.value}</h3>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className={`text-xs text-${stat.color}-500 font-medium mt-2`}>{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts & Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Blast Analytics Chart */}
            <div className="p-6 bg-card rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Blast Analytics</h3>
                <IconCalendar className="w-5 h-5 text-muted-foreground" />
              </div>
              {analytics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <IconCalendar className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No data for selected period</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {analytics.map((item, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{format(new Date(item.date), 'MMM dd, yyyy')}</span>
                          <span className="font-medium">{item.sent} sent</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
                          <div
                            className="bg-green-500 transition-all"
                            style={{ width: `${item.sent > 0 ? (item.success / item.sent) * 100 : 0}%` }}
                          />
                          <div
                            className="bg-red-500 transition-all"
                            style={{ width: `${item.sent > 0 ? (item.failed / item.sent) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="text-green-500">{item.success} success</span>
                          <span className="text-red-500">{item.failed} failed</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Recent Blasts List */}
            <div className="p-6 bg-card rounded-2xl border border-border">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">Recent Campaigns</h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  {recentBlasts.length} campaigns
                </span>
              </div>
              <div className="space-y-3">
                {recentBlasts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <IconSend className="w-12 h-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No campaigns yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first blast campaign!</p>
                  </div>
                ) : (
                  recentBlasts.map((blast) => (
                    <div key={blast.id} className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{blast.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {blast.recipientCount} recipients • {new Date(blast.scheduledAt).toLocaleDateString('ms-MY')}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs">
                            <span className="text-green-600 font-medium">{blast.successCount} sent</span>
                            <span className="text-red-600 font-medium">{blast.failedCount} failed</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                          blast.status === "completed" ? "bg-green-100 text-green-700" :
                          blast.status === "partial" ? "bg-yellow-100 text-yellow-700" :
                          blast.status === "running" ? "bg-blue-100 text-blue-700" :
                          blast.status === "pending" ? "bg-orange-100 text-orange-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {blast.status === "partial" ? "Partial" : blast.status.charAt(0).toUpperCase() + blast.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
