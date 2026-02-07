"use client";
import React, { useState, useEffect } from "react";
import { 
  IconUser, 
  IconPhone, 
  IconInfoCircle, 
  IconDeviceFloppy, 
  IconCamera,
  IconCheck,
  IconLoader2
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface SessionData {
  displayName: string | null;
  phoneNumber: string | null;
  about: string | null;
  profilePicUrl: string | null;
  status: string;
}

export default function ProfilePage() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile", {
        credentials: "include",
      });
      const data = await res.json();
      
      if (data) {
        setSession(data);
        setName(data.displayName || "");
        setAbout(data.about || "");
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ displayName: name, about }),
      });
      
      if (res.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return "Not connected";
    const cleaned = phone.replace(/\D/g, "");
    return `+${cleaned}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <IconLoader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">WhatsApp Profile</h1>
          <p className="text-muted-foreground">Manage your official WhatsApp identity and presence.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed",
            showSuccess ? "bg-green-500 text-white shadow-green-500/20" : "bg-primary text-primary-foreground"
          )}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : showSuccess ? (
            <IconCheck size={18} />
          ) : (
            <IconDeviceFloppy size={18} />
          )}
          {isSaving ? "Saving..." : showSuccess ? "Account Updated" : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col items-center group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative mb-6">
              <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center text-white shadow-2xl shadow-green-500/30 overflow-hidden">
                {session?.profilePicUrl ? (
                  <img src={session.profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <IconUser size={64} />
                )}
              </div>
              <button className="absolute bottom-0 right-0 p-2.5 bg-card border border-border rounded-xl text-muted-foreground hover:text-green-500 transition-all shadow-lg hover:scale-110">
                <IconCamera size={18} />
              </button>
            </div>

            <h2 className="text-xl font-bold text-center">{name || session?.displayName || "Not set"}</h2>
            <p className="text-sm text-neutral-500 font-medium">{formatPhone(session?.phoneNumber)}</p>
            
            <div className="mt-8 pt-8 border-t border-border w-full space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground uppercase font-bold tracking-widest">Account Status</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter",
                  session?.status === "connected" 
                    ? "bg-green-500/10 text-green-500" 
                    : "bg-red-500/10 text-red-500"
                )}>
                  {session?.status === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground uppercase font-bold tracking-widest">Connection</span>
                <span className={cn(
                  "font-bold uppercase tracking-tighter",
                  session?.status === "connected" ? "text-green-600" : "text-muted-foreground"
                )}>
                  {session?.status === "connected" ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-8 shadow-sm space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Identity Details
              </h3>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground ml-1">WhatsApp Display Name</label>
                <div className="relative">
                  <IconUser size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-1 focus:ring-green-500 transition-all font-medium" 
                    placeholder="Enter your name"
                  />
                </div>
                <p className="text-[10px] text-neutral-400 ml-1 italic">This name will be visible to everyone you message.</p>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-neutral-500 ml-1">Account Biography (About)</label>
                <div className="relative">
                  <IconInfoCircle size={18} className="absolute left-4 top-4 text-neutral-400" />
                  <textarea 
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    rows={4}
                    className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-1 focus:ring-green-500 transition-all font-medium resize-none" 
                    placeholder="Tell your customers about your business..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-neutral-100 dark:border-neutral-700 space-y-4">
               <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                Platform Linkage
              </h3>
              
              <div className="flex items-center gap-4 bg-primary/5 border border-primary/10 p-5 rounded-3xl">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  <IconPhone size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">System Integration</p>
                  <p className="text-xs text-muted-foreground">Your profile changes are synchronized across your WhatsApp Business account and AI agents.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
