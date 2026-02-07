"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { IconChecks, IconFile, IconFileDescription, IconPlayerPlay } from "@tabler/icons-react";

interface Attachment {
  name: string;
  type: string;
  url?: string;
  size?: number;
}

interface WhatsAppPreviewProps {
  message: string;
  attachment?: Attachment | null;
  attachments?: Attachment[];
  className?: string;
}

// Get API URL - same logic as login and blast pages
function getApiUrl(): string {
  if (typeof window === "undefined") return "http://localhost:3001";

  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl !== "http://localhost:3001") {
    return envUrl;
  }

  // Fallback: construct from current location
  const hostname = window.location.hostname;
  let apiUrl = "http://localhost:3001";

  if (hostname === "dev.owlscottage.com") {
    apiUrl = "https://api-dev.owlscottage.com";
  } else if (hostname === "owlscottage.com" || hostname === "www.owlscottage.com") {
    apiUrl = "https://api.owlscottage.com";
  } else if (hostname.endsWith(".owlscottage.com")) {
    const parts = hostname.split(".");
    if (parts[0] === "www") {
      parts.shift();
    }
    parts[0] = "api";
    apiUrl = `https://${parts.join(".")}`;
  }

  return apiUrl;
}

// Helper to convert upload URL to accessible URL
const getAccessibleUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const apiUrl = getApiUrl();
  const baseUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;

  if (url.startsWith("/uploads/")) {
    return `${baseUrl}/data${url}`;
  }

  if (url.startsWith("/data/")) {
    return `${baseUrl}${url}`;
  }

  return `${baseUrl}/data${url.startsWith("/") ? url : `/${url}`}`;
};

export function WhatsAppPreview({ message, attachment, attachments, className }: WhatsAppPreviewProps) {
  const [time, setTime] = React.useState("");
  const allAttachments = attachments || (attachment ? [attachment] : []);

  React.useEffect(() => {
    setTime(format(new Date(), "HH:mm"));
  }, []);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes("image")) return null;
    if (type.includes("video")) return <IconPlayerPlay size={24} className="text-white" />;
    if (type.includes("pdf")) return <IconFileDescription size={32} className="text-red-500" />;
    return <IconFile size={32} className="text-neutral-400" />;
  };

  return (
    <div className={cn("bg-emerald-50 dark:bg-neutral-900 p-4 rounded-3xl min-h-[500px] max-h-[600px] flex flex-col gap-2 relative overflow-hidden border border-emerald-100 dark:border-neutral-800", className)}>
      {/* WhatsApp Background Pattern */}
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.03] pointer-events-none"
           style={{ backgroundImage: "radial-gradient(#000 0.5px, transparent 0.5px)", backgroundSize: "10px 10px" }} />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 pb-3 border-b border-emerald-200/50 dark:border-neutral-700 shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-white font-bold">
          Y
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-foreground">Your Name</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">online</p>
        </div>
      </div>

      {/* Message Bubbles - Scrollable but scrollbar hidden */}
      <div className="relative z-10 flex flex-col gap-2 py-2 overflow-y-auto overflow-x-hidden flex-1 no-scrollbar">
        {allAttachments.length === 0 && !message && (
          <p className="text-center text-muted-foreground text-sm py-8">Add a message or attachment to see preview</p>
        )}

        {/* Attachments with message */}
        {allAttachments.map((att, idx) => {
          const accessibleUrl = getAccessibleUrl(att.url);
          return (
            <div key={idx} className="self-start max-w-[300px]">
              <div className="bg-white dark:bg-neutral-800 rounded-2xl rounded-tl-sm shadow-sm border border-neutral-100 dark:border-neutral-700 overflow-hidden">
                {/* Media Preview */}
                {att.type.includes("image") && accessibleUrl ? (
                  <div className="relative">
                    <img
                      src={accessibleUrl}
                      alt={att.name}
                      className="w-full h-auto max-h-[250px] object-cover"
                    />
                  </div>
                ) : att.type.includes("video") && accessibleUrl ? (
                  <div className="relative aspect-video bg-neutral-900 flex items-center justify-center">
                    <video
                      src={accessibleUrl}
                      className="w-full h-full object-cover max-h-[250px]"
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <IconPlayerPlay size={24} className="text-emerald-600 fill-emerald-600" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900">
                    {getFileIcon(att.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{att.name}</p>
                      {att.size && <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>}
                    </div>
                  </div>
                )}

                {/* Caption - Only for first attachment */}
                {message && idx === 0 && (
                  <div className="px-2 pb-1">
                    <p className="text-[13px] text-foreground whitespace-pre-wrap break-words leading-relaxed">
                      {(() => {
                        let previewMsg = message
                          .replace(/\{\{(name|nama)\}\}/gi, "John")
                          .replace(/\{\{phone\}\}/gi, "+60123456789");

                        // Handle {{date}} placeholder - show today's date in DD/MM/YYYY format
                        const today = new Date();
                        const dd = String(today.getDate()).padStart(2, '0');
                        const mm = String(today.getMonth() + 1).padStart(2, '0');
                        const yyyy = today.getFullYear();
                        previewMsg = previewMsg.replace(/\{\{date\}\}/gi, `${dd}/${mm}/${yyyy}`);

                        return previewMsg;
                      })()}
                    </p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex items-center justify-end gap-1 px-2 pb-1">
                  <span className="text-[9px] text-neutral-400 font-medium">{time || "--:--"}</span>
                  <IconChecks size={14} className="text-blue-400" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Text-only message */}
        {allAttachments.length === 0 && message && (
          <div className="self-start max-w-[85%]">
            <div className="bg-white dark:bg-neutral-800 p-2 rounded-2xl rounded-tl-sm shadow-sm border border-neutral-100 dark:border-neutral-700">
              <p className="text-[13px] text-foreground whitespace-pre-wrap break-words leading-relaxed px-1 py-0.5">
                {(() => {
                  let previewMsg = message
                    .replace(/\{\{(name|nama)\}\}/gi, "John")
                    .replace(/\{\{phone\}\}/gi, "+60123456789");

                  // Handle {{date}} placeholder - show today's date in DD/MM/YYYY format
                  const today = new Date();
                  const dd = String(today.getDate()).padStart(2, '0');
                  const mm = String(today.getMonth() + 1).padStart(2, '0');
                  const yyyy = today.getFullYear();
                  previewMsg = previewMsg.replace(/\{\{date\}\}/gi, `${dd}/${mm}/${yyyy}`);

                  return previewMsg;
                })()}
              </p>
              <div className="flex items-center justify-end gap-1 px-1 pb-0.5">
                <span className="text-[9px] text-neutral-400 font-medium">{time || "--:--"}</span>
                <IconChecks size={14} className="text-blue-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Multiple files indicator */}
      {allAttachments.length > 1 && (
        <div className="relative z-10 self-start shrink-0">
          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full font-medium">
            {allAttachments.length} file{allAttachments.length > 1 ? "s" : ""} attached
          </span>
        </div>
      )}
    </div>
  );
}
