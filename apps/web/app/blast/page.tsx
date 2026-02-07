"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  IconUpload,
  IconUsers,
  IconMessage,
  IconPlayerPlay,
  IconPaperclip,
  IconCalendar,
  IconClock,
  IconEye,
  IconArrowRight,
  IconSearch,
  IconHistory,
  IconX,
  IconFileDescription,
  IconPlus,
  IconLoader2,
  IconAlertTriangle,
  IconCaretDown,
  IconGripVertical
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { WhatsAppPreview } from "@/components/blast/whatsapp-preview";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { DatePickerProps } from "react-datepicker";
import { useToast } from "@/components/ui/toast";
const DatePicker = dynamic(
  () => import("react-datepicker").then(mod => mod.default as unknown as ComponentType<DatePickerProps>),
  {
    ssr: false,
    loading: () => <div className="w-full h-10 bg-muted/50 rounded-xl animate-pulse" />
  }
);
import "react-datepicker/dist/react-datepicker.css";
import "../../app/calendar.css";

interface Contact {
  id: string;
  name: string | null;
  phoneNumber: string;
  tags: { id: string; name: string; color: string }[];
}

interface Campaign {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  sentCount: number;
  recipientCount: number;
}

interface Attachment {
  name: string;
  type: string;
  mimeType?: string; // Original mimetype for proper WhatsApp sending
  size: number;
  url: string;
}

interface UploadProgress {
  fileName: string;
  fileSize: number;
  uploaded: number;
  total: number;
}

export default function BlastPage() {
  const router = useRouter();
  const { success, error: toastError, toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [isScheduled, setIsScheduled] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Autocomplete states
  const [showPlaceholderMenu, setShowPlaceholderMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const cursorPositionRef = useRef(0); // Use ref for immediate value
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholderMenuRef = useRef<HTMLDivElement>(null);

  // Available placeholders
  const placeholders = [
    { key: "{{name}}", label: "Name", description: "Contact's name", icon: "N" },
    { key: "{{phone}}", label: "Phone", description: "Contact's phone number", icon: "P" },
    { key: "{{date}}", label: "Date", description: "Select a date", icon: "D", hasPicker: true },
  ];

  // Format date to DD/MM/YYYY
  const formatDateToDDMMYYYY = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Real data states
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    setIsMounted(true);
    isMountedRef.current = true;
    setStartDate(new Date());

    // Fetch data
    fetchContacts();
    fetchCampaigns();
    fetchWhatsAppStatus();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-refresh campaigns every 3 seconds to update running status
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if there are running campaigns
      const hasRunning = campaigns.some(c => c.status === "running" || c.status === "pending");
      if (hasRunning) {
        fetchCampaigns();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [campaigns]);

  // Handle URL query parameter - pre-select contact from Chat
  useEffect(() => {
    if (contacts.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const phoneParam = params.get('phone');

    if (phoneParam) {
      // Normalize the phone number for comparison
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      const targetPhone = normalizePhone(phoneParam);

      // Find matching contact
      const matchedContact = contacts.find(c => normalizePhone(c.phoneNumber) === targetPhone);

      if (matchedContact) {
        // Pre-select this contact
        setSelectedContacts([matchedContact.id]);
        console.log('[Blast] Pre-selected contact from Chat:', matchedContact);
      } else {
        console.log('[Blast] No matching contact found for phone:', phoneParam);
      }
    }
  }, [contacts]);

  const fetchWhatsAppStatus = async () => {
    try {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      const data = await res.json();
      setWhatsappConnected(data.connected || false);
      return data.sessionId || null; // Return session ID for socket connection
    } catch (error) {
      console.error("Failed to fetch WhatsApp status:", error);
      return null;
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/contacts?limit=100", { credentials: "include" });
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns?limit=10", { credentials: "include" });
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!title || !message || selectedContacts.length === 0) {
      toastError("Please fill in title, message, and select at least one contact.");
      return;
    }

    if (!whatsappConnected) {
      toastError("WhatsApp is not connected! Please connect your WhatsApp account first in Settings.");
      return;
    }

    try {
      setLaunching(true);
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          message,
          recipientIds: selectedContacts,
          // Send all attachments for multiple file support
          attachments: attachments.length > 0 ? attachments : undefined,
          // Keep legacy fields for backward compatibility
          mediaUrl: attachments[0]?.url,
          mediaType: attachments[0]?.type?.startsWith("image") ? "image" : attachments[0]?.type?.startsWith("video") ? "video" : attachments[0]?.url ? "document" : null,
          scheduledAt: isScheduled && startDate ? startDate.toISOString() : null,
        }),
      });

      if (res.ok) {
        const campaign = await res.json();
        // Start the campaign immediately if not scheduled
        if (!isScheduled) {
          await fetch(`/api/campaigns/${campaign.id}/start`, {
            method: "POST",
            credentials: "include",
          });
        }
        // Reset form
        setTitle("");
        setMessage("");
        setSelectedContacts([]);
        setAttachments([]);
        fetchCampaigns();
        success("Campaign created successfully!");
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
      toastError("Failed to create campaign");
    } finally {
      setLaunching(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format bytes to MB
  const formatMB = (bytes: number): string => {
    return (bytes / (1024 * 1024)).toFixed(2);
  };

  // Insert placeholder at cursor position (replacing the `{` that triggered the menu)
  const insertPlaceholder = (placeholder: string) => {
    // If it's a date placeholder, show date picker
    if (placeholder === "{{date}}") {
      setShowDatePicker(true);
      setShowPlaceholderMenu(false);
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Use the cursor position from ref (immediate value, not async state)
    // This is the position AFTER the `{` was typed
    const insertPos = cursorPositionRef.current;

    // Replace the `{` with the full placeholder
    const newText = message.substring(0, insertPos - 1) + placeholder + message.substring(insertPos);

    setMessage(newText);
    setShowPlaceholderMenu(false);

    // Set cursor after placeholder
    setTimeout(() => {
      const newCursorPos = (insertPos - 1) + placeholder.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Handle date selection from picker
  const handleDateSelect = (date: Date | null) => {
    if (!date) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    // Use the cursor position from ref
    const insertPos = cursorPositionRef.current;

    // Format date as DD/MM/YYYY
    const formattedDate = formatDateToDDMMYYYY(date);
    // Replace the `{` with the date
    const newText = message.substring(0, insertPos - 1) + formattedDate + message.substring(insertPos);

    setMessage(newText);
    setShowDatePicker(false);
    setShowPlaceholderMenu(false);
    setSelectedDate(null);

    // Set cursor after inserted date
    setTimeout(() => {
      const newCursorPos = (insertPos - 1) + formattedDate.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Handle textarea input for autocomplete
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    cursorPositionRef.current = cursorPos; // Store in ref for immediate access

    // Check if user just typed '{'
    const textBeforeCursor = value.substring(0, cursorPos);
    if (textBeforeCursor.endsWith("{")) {
      // Calculate dropdown position based on textarea
      const textareaEl = textareaRef.current;
      if (textareaEl) {
        const rect = textareaEl.getBoundingClientRect();
        // Position dropdown above the textarea, aligned left
        setDropdownPosition({
          top: rect.top - 10, // 10px above textarea
          left: rect.left,
        });
      }
      setShowPlaceholderMenu(true);
    } else if (showPlaceholderMenu && !textBeforeCursor.endsWith("{{")) {
      // Hide if not typing placeholder
      setShowPlaceholderMenu(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (placeholderMenuRef.current && !placeholderMenuRef.current.contains(event.target as Node)) {
        setShowPlaceholderMenu(false);
      }
    };

    if (showPlaceholderMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPlaceholderMenu]);

  // CHUNKED UPLOAD - Break file into small chunks for slow Cloudflare Tunnel
  // Enhanced for 50MB+ files with adaptive chunk sizing and better retry logic
  const uploadSingleFile = async (file: File): Promise<Attachment | null> => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    
    // Adaptive chunk sizing based on network speed
    // Start small, increase if fast, decrease if slow
    const MIN_CHUNK = 10 * 1024;        // 10KB minimum
    const MAX_CHUNK = 50 * 1024 * 1024; // 50MB maximum
    const START_CHUNK = 10 * 1024;      // Start at 10KB
    let currentChunkSize = START_CHUNK;
    
    // Adjust chunk size based on last upload duration
    const STEP_SIZE = 10 * 1024; // Increment/decrement by 10KB
    const adjustChunkSize = (durationMs: number, lastChunkSize: number): number => {
      // Target: each chunk should take 1-3 seconds
      if (durationMs < 1000) {
        // Fast! Add 10KB (max 50MB)
        return Math.min(lastChunkSize + STEP_SIZE, MAX_CHUNK);
      } else if (durationMs > 5000) {
        // Slow! Reduce by 10KB (min 10KB)
        return Math.max(lastChunkSize - STEP_SIZE, MIN_CHUNK);
      } else if (durationMs > 3000) {
        // Slightly slow, reduce by 5KB
        return Math.max(lastChunkSize - (STEP_SIZE / 2), MIN_CHUNK);
      }
      // Keep current size (1-3 seconds is good)
      return lastChunkSize;
    };
    
    // Use 1MB average for backend chunk count estimation (actual chunks will vary)
    const AVG_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB average for estimation
    const MAX_RETRIES = 7;
    const CHUNK_TIMEOUT = 180000; // 180 seconds per chunk

    // Get session_id from cookie for cross-origin requests
    const getSessionId = (): string | null => {
      if (typeof document === "undefined") return null;
      const cookies = document.cookie.split("; ");
      const sessionCookie = cookies.find(c => c.startsWith("session_id="));
      return sessionCookie ? sessionCookie.split("=")[1] : null;
    };

    const sessionId = getSessionId();
    const estimatedChunks = Math.ceil(file.size / AVG_CHUNK_SIZE);
    console.log(`[ChunkedUpload] Starting: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB), ~${estimatedChunks} chunks, sessionId: ${sessionId?.substring(0, 8)}...`);

    if (!sessionId) {
      console.error("[ChunkedUpload] No session found - user not logged in");
      toastError("Please log in to upload files");
      return null;
    }

    // Headers with session ID
    const authHeaders = {
      "Content-Type": "application/json",
      "X-Session-ID": sessionId,
    };

    // Helper: Upload a single chunk with retry (using byte offset)
    const uploadChunkWithRetry = async (
      chunk: Blob,
      byteOffset: number,
      chunkNum: number,
      uploadId: string,
      attempt = 1
    ): Promise<boolean> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CHUNK_TIMEOUT);

      try {
        const startTime = Date.now();
        const chunkRes = await fetch(`${API_URL}/api/campaigns/upload/chunked/chunk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Upload-ID": uploadId,
            "X-Chunk-Index": chunkNum.toString(),
            "X-Byte-Offset": byteOffset.toString(), // Send byte offset for accurate writing
            "X-Session-ID": sessionId,
          },
          body: chunk,
          signal: controller.signal,
        });
        const elapsed = Date.now() - startTime;

        clearTimeout(timeoutId);

        if (!chunkRes.ok) {
          const errorText = await chunkRes.text();
          console.error(`[ChunkedUpload] Chunk ${chunkNum} FAILED (attempt ${attempt}):`, chunkRes.status, errorText);

          if (attempt < MAX_RETRIES) {
            const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 128000);
            console.log(`[ChunkedUpload] Retrying chunk ${chunkNum} after ${backoffMs/1000}s...`);
            await new Promise(r => setTimeout(r, backoffMs));
            return uploadChunkWithRetry(chunk, byteOffset, chunkNum, uploadId, attempt + 1);
          }
          return false;
        }

        console.log(`[ChunkedUpload] Chunk ${chunkNum} (${(chunk.size/1024).toFixed(0)}KB) SUCCESS (${elapsed}ms)`);
        return true;
      } catch (error: any) {
        clearTimeout(timeoutId);

        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 128000);
          console.log(`[ChunkedUpload] Retrying chunk ${chunkNum} after ${backoffMs/1000}s...`);
          await new Promise(r => setTimeout(r, backoffMs));
          return uploadChunkWithRetry(chunk, byteOffset, chunkNum, uploadId, attempt + 1);
        }
        return false;
      }
    };

    try {
      // Step 1: Initialize chunked upload (use average chunk size for estimation)
      const startRes = await fetch(`${API_URL}/api/campaigns/upload/chunked/start`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          chunkSize: AVG_CHUNK_SIZE, // Backend uses this for estimation only
        }),
      });

      if (!startRes.ok) {
        console.error("[ChunkedUpload] Start failed:", startRes.status, await startRes.text());
        return null;
      }

      const startData = await startRes.json();
      const { uploadId } = startData;
      console.log(`[ChunkedUpload] Initialized: uploadId=${uploadId}, random chunks mode`);

      // Step 2: Upload chunks with ADAPTIVE sizing (adjusts to network speed)
      const totalBytes = file.size;
      let bytesUploaded = 0;
      let chunkNum = 0;
      
      console.log(`[ChunkedUpload] Starting adaptive upload: initial chunk ${(currentChunkSize/1024).toFixed(0)}KB`);
      
      while (bytesUploaded < totalBytes) {
        // Use current adaptive chunk size
        const end = Math.min(bytesUploaded + currentChunkSize, totalBytes);
        const chunk = file.slice(bytesUploaded, end);
        
        // Time the upload
        const startTime = Date.now();
        const success = await uploadChunkWithRetry(chunk, bytesUploaded, chunkNum, uploadId);
        const duration = Date.now() - startTime;
        
        if (!success) {
          console.error(`[ChunkedUpload] Chunk ${chunkNum} failed after ${MAX_RETRIES} attempts`);
          await fetch(`${API_URL}/api/campaigns/upload/chunked/cancel`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ uploadId }),
          });
          toastError(`Upload failed. Please check your connection and try again.`);
          return null;
        }

        bytesUploaded = end;
        chunkNum++;

        // Adjust chunk size for NEXT chunk based on this chunk's speed
        const prevSize = currentChunkSize;
        currentChunkSize = adjustChunkSize(duration, currentChunkSize);
        if (currentChunkSize !== prevSize) {
          console.log(`[ChunkedUpload] Chunk ${chunkNum-1} took ${duration}ms → adjusting chunk: ${(prevSize/1024).toFixed(0)}KB → ${(currentChunkSize/1024).toFixed(0)}KB`);
        }

        // Update progress
        setUploadProgress({
          fileName: file.name,
          fileSize: file.size,
          uploaded: end,
          total: totalBytes,
        });
      }

      // Step 3: Complete upload
      console.log("[ChunkedUpload] All chunks uploaded, completing...");
      const completeRes = await fetch(`${API_URL}/api/campaigns/upload/chunked/complete`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ uploadId }),
      });

      if (!completeRes.ok) {
        console.error("[ChunkedUpload] Complete failed:", completeRes.status, await completeRes.text());
        return null;
      }

      const data = await completeRes.json();
      console.log("[ChunkedUpload] Complete:", data);

      return {
        name: data.name || file.name,
        type: data.type || "document",
        mimeType: data.mimeType || file.type,
        size: data.size || file.size,
        url: data.url,
      };
    } catch (error) {
      console.error("[ChunkedUpload] Error:", error);
      return null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingFile(true);

    try {
      const newAttachments: Attachment[] = [...attachments];
      let successCount = 0;

      for (const file of files) {
        // Show progress for current file
        setUploadProgress({
          fileName: file.name,
          fileSize: file.size,
          uploaded: 0,
          total: file.size,
        });

        const result = await uploadSingleFile(file);
        if (result) {
          newAttachments.push(result);
          successCount++;
        }
      }

      setAttachments(newAttachments);

      if (successCount < files.length) {
        toast(`${successCount}/${files.length} files uploaded successfully.`);
      }

      // Clear the file input so same files can be selected again
      e.target.value = "";
    } catch (error) {
      console.error("Error uploading files:", error);
      toastError("Failed to upload files. Please try again.");
    } finally {
      setUploadingFile(false);
      setUploadProgress(null);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Drag and drop reordering for attachments
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const moveAttachment = (fromIndex: number, toIndex: number) => {
    const newAttachments = [...attachments];
    const [moved] = newAttachments.splice(fromIndex, 1);
    newAttachments.splice(toIndex, 0, moved);
    setAttachments(newAttachments);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== dropIndex) {
      moveAttachment(dragIndex, dropIndex);
    }
    setDragIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = !searchQuery || 
      (c.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.phoneNumber.includes(searchQuery);
    const matchesTag = !tagFilter || c.tags?.some(t => t.name === tagFilter);
    return matchesSearch && matchesTag;
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* WhatsApp Connection Warning */}
      {!whatsappConnected && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
            <IconAlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-amber-700 dark:text-amber-400">WhatsApp Not Connected</p>
            <p className="text-xs text-amber-600 dark:text-amber-500">Please connect your WhatsApp account in Settings before launching a campaign.</p>
          </div>
          <button
            onClick={() => window.location.href = '/settings'}
            className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold text-xs hover:bg-amber-600 transition-all"
          >
            Connect
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Blasting Studio</h1>
          <p className="text-muted-foreground text-sm">Design and schedule your WhatsApp campaigns.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all border border-neutral-200 dark:border-neutral-700"
          >
            <IconEye size={18} /> {showPreview ? "Edit Mode" : "Preview"}
          </button>
           <button 
             onClick={handleLaunchCampaign}
             disabled={launching || !title || !message || selectedContacts.length === 0}
             className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {launching ? (
               <IconLoader2 size={18} className="animate-spin" />
             ) : (
               <IconPlayerPlay size={18} />
             )}
             {launching ? "Launching..." : "Launch Campaign"}
           </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
        {/* Left 70% - Message Composition */}
        <div className="lg:w-[70%] flex flex-col overflow-hidden">
          {showPreview ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold text-lg">WhatsApp Preview</h3>
                <span className="text-[10px] bg-green-500/10 text-green-600 px-3 py-1 rounded-full font-extrabold uppercase tracking-widest">Visual Test</span>
              </div>
              <WhatsAppPreview
                message={message}
                attachments={attachments}
                className="flex-1"
              />
            </div>
          ) : (
            <div className="flex flex-col h-full gap-4">
              {/* Campaign Title */}
              <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Campaign Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g. Promo Raya May 2026"
                  className="w-full bg-muted/50 dark:bg-neutral-800 border-none rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none transition-all text-foreground"
                />
              </div>

              {/* Message Content */}
              <div className="bg-card border border-border rounded-3xl p-5 shadow-sm flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Message Content</label>
                  <div className="flex gap-2">
                    {placeholders.map((ph) => (
                      <button
                        key={ph.key}
                        onClick={() => insertPlaceholder(ph.key)}
                        className="text-[10px] font-bold bg-muted px-2 py-1 rounded-lg hover:bg-green-500 hover:text-white transition-all text-muted-foreground"
                        title={ph.description}
                      >
                        {ph.key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea with autocomplete */}
                <div className="relative flex-1">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Hi {{name}}! We have great news for you..."
                    className="w-full h-full bg-muted/50 dark:bg-neutral-800 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all resize-none custom-scrollbar text-foreground pr-12"
                  />

                  {/* Placeholder indicator icon */}
                  <div className="absolute bottom-3 right-3 text-muted-foreground pointer-events-none">
                    <IconCaretDown size={16} />
                  </div>
                </div>

                {/* Autocomplete dropdown - rendered via Portal to avoid overflow issues */}
                {showPlaceholderMenu && typeof document !== "undefined" && createPortal(
                  <div
                    ref={placeholderMenuRef}
                    className="fixed z-[9999] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-2xl overflow-hidden min-w-[240px] animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                    }}
                  >
                    <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Insert Placeholder</p>
                    </div>
                    {placeholders.map((ph) => (
                      <button
                        key={ph.key}
                        onClick={() => insertPlaceholder(ph.key)}
                        className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                          <span className="text-xs font-bold text-green-600 dark:text-green-400">{ph.icon}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-foreground">{ph.key}</p>
                          <p className="text-[10px] text-muted-foreground">{ph.description}</p>
                        </div>
                        {ph.hasPicker && (
                          <IconCalendar size={14} className="text-green-500" />
                        )}
                      </button>
                    ))}
                  </div>,
                  document.body
                )}

                {/* Date Picker Modal */}
                {showDatePicker && (
                  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-foreground">Select Date</h3>
                        <button
                          onClick={() => {
                            setShowDatePicker(false);
                            setSelectedDate(null);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <IconX size={20} />
                        </button>
                      </div>

                      {isMounted && (
                        <DatePicker
                          selected={selectedDate}
                          onChange={(date: Date | null) => {
                            setSelectedDate(date);
                            if (date) handleDateSelect(date);
                          }}
                          inline
                          minDate={new Date()}
                          dateFormat="ddMMyyyy"
                          className="w-full"
                        />
                      )}

                      <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                        <p className="text-[10px] text-center text-muted-foreground">
                          Format: DD/MM/YYYY (e.g., 03/02/2026)
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Attachments */}
                <div className="mt-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.mp3,.mp4,.mov,.avi,.mkv,.jpg,.jpeg,.png,.gif,.webp"
                  />
                  {uploadingFile && uploadProgress ? (
                    <div className="flex flex-col gap-2 p-4 border-2 border-dashed border-green-500/50 bg-green-500/5 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <IconLoader2 size={18} className="animate-spin text-green-500" />
                          <span className="text-xs font-bold text-foreground">Uploading {uploadProgress.fileName}...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                            {Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)}%
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {formatMB(uploadProgress.uploaded)} / {formatMB(uploadProgress.total)} MB
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-200 ease-out"
                          style={{ width: `${Math.min(100, (uploadProgress.uploaded / uploadProgress.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : attachments.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          Attachments ({attachments.length} file{attachments.length > 1 ? 's' : ''})
                        </span>
                        <span className="text-[9px] text-muted-foreground">
                          Drag to reorder • First one gets caption
                        </span>
                      </div>
                      {attachments.map((att, index) => (
                        <div
                          key={`${att.name}-${index}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "flex items-center justify-between p-3 bg-green-500/5 border border-dashed border-green-500/30 rounded-2xl cursor-move transition-all",
                            dragIndex === index && "opacity-50 scale-[0.98]",
                            "hover:bg-green-500/10"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Drag handle */}
                            <div className="text-muted-foreground cursor-grab active:cursor-grabbing">
                              <IconGripVertical size={16} />
                            </div>
                            {/* Order number */}
                            <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center text-white text-[10px] font-bold">
                              {index + 1}
                            </div>
                            {/* File icon */}
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
                              <IconFileDescription size={16} />
                            </div>
                            {/* File info */}
                            <div>
                              <p className="text-xs font-bold truncate max-w-[150px] text-foreground">{att.name}</p>
                              <p className="text-[9px] text-muted-foreground">{formatMB(att.size)} MB</p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                          >
                            <IconX size={18} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          fileInputRef.current?.click();
                        }}
                        className="w-full flex items-center justify-center gap-2 p-2 border border-dashed rounded-xl transition-all text-[10px] font-bold text-muted-foreground hover:border-green-500 hover:bg-green-500/5"
                      >
                        <IconPlus size={14} /> Add More Files
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-border rounded-2xl hover:border-green-500 hover:bg-green-500/5 transition-all group"
                    >
                      <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center group-hover:bg-green-500 transition-colors">
                        <IconPaperclip className="text-muted-foreground group-hover:text-white" size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-xs text-foreground">Add Attachments</p>
                        <p className="text-[10px] text-muted-foreground">Images, Videos, Documents</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div className={cn(
                "bg-card border border-border rounded-3xl p-5 shadow-sm transition-all",
                !isScheduled && "opacity-60"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Scheduling</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isScheduled}
                      onChange={() => setIsScheduled(!isScheduled)}
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-green-500"></div>
                    <span className="ml-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      {isScheduled ? "On" : "Off"}
                    </span>
                  </label>
                </div>
                
                {isMounted && (
                  <div className={cn("flex flex-wrap gap-4 transition-all", !isScheduled && "pointer-events-none")}>
                     <div className="relative flex-1">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 z-10 pointer-events-none">
                          <IconCalendar size={18} />
                        </div>
                        <DatePicker
                          selected={startDate}
                          onChange={(date: Date | null) => setStartDate(date)}
                          showTimeSelect
                          timeIntervals={1}
                          portalId="datepicker-portal"
                          disabled={!isScheduled}
                          dateFormat="MMMM d, yyyy h:mm aa"
                          className="w-full bg-neutral-50 dark:bg-neutral-800 border-none rounded-xl py-2.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none transition-all disabled:opacity-50 text-foreground cursor-pointer"
                          placeholderText="Set Date & Time"
                        />
                     </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right 30% - Sidebar Actions */}
        <div className="lg:w-[30%] flex flex-col gap-6 overflow-hidden">
          {/* Contacts Sidebar */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Select Contacts</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (selectedContacts.length === filteredContacts.length) {
                      setSelectedContacts([]);
                    } else {
                      setSelectedContacts(filteredContacts.map(c => c.id));
                    }
                  }}
                  className="text-[10px] font-bold text-green-500 hover:text-green-600 transition-colors"
                >
                  {selectedContacts.length === filteredContacts.length && filteredContacts.length > 0 ? "Deselect All" : "Select All"}
                </button>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {selectedContacts.length}
                </span>
              </div>
            </div>
            
            <div className="space-y-4 mb-4">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-muted/50 dark:bg-neutral-800 border-none rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-green-500 outline-none transition-all text-foreground"
                />
              </div>

              {/* Tag Filters */}
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(contacts.flatMap(c => c.tags?.map(t => t.name) || []))].map(tagName => (
                  <button
                    key={tagName}
                    onClick={() => setTagFilter(tagFilter === tagName ? null : tagName)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all",
                      tagFilter === tagName 
                        ? "bg-green-500 border-green-500 text-white" 
                        : "bg-neutral-50 dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-500 hover:border-neutral-200"
                    )}
                  >
                    #{tagName}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
              {filteredContacts.map((contact) => (
                <div 
                  key={contact.id}
                  onClick={() => {
                    if (selectedContacts.includes(contact.id)) {
                      setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                    } else {
                      setSelectedContacts([...selectedContacts, contact.id]);
                    }
                  }}
                  className={cn(
                    "p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group",
                    selectedContacts.includes(contact.id) 
                      ? "bg-green-500/10 border-green-500/30" 
                      : "bg-muted/40 dark:bg-neutral-800/50 border-transparent hover:border-border hover:bg-card transition-colors"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px]",
                      selectedContacts.includes(contact.id) ? "bg-green-500 text-white" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                    )}>
                      {(contact.name || contact.phoneNumber).charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{contact.name || contact.phoneNumber}</p>
                      <div className="flex gap-1 items-center">
                        {contact.tags?.[0] && (
                          <>
                            <p className="text-[9px] text-muted-foreground">#{contact.tags[0].name}</p>
                            <span className="w-1 h-1 bg-muted dark:bg-neutral-700 rounded-full" />
                          </>
                        )}
                        <p className="text-[9px] text-muted-foreground">
                          {contact.phoneNumber.startsWith('+') ? contact.phoneNumber : `+${contact.phoneNumber}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  {selectedContacts.includes(contact.id) && (
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <IconPlayerPlay size={8} className="text-white fill-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {filteredContacts.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-neutral-400">{contacts.length === 0 ? "No contacts yet. Add contacts first." : "No contacts found matching filter"}</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => window.location.href = '/contact'}
              className="w-full mt-4 py-3 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <IconPlus size={14} /> Add Contact
            </button>
          </div>

          {/* History Widget */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <IconHistory size={18} className="text-neutral-400" /> History
              </h3>
            </div>
            <div className="space-y-3 h-[120px] overflow-y-auto no-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <IconLoader2 className="animate-spin text-muted-foreground" size={20} />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-neutral-400">No campaigns yet</p>
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    onClick={() => router.push(`/blast/report/${campaign.id}`)}
                    className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 dark:bg-neutral-800/30 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold truncate max-w-[120px] text-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{campaign.title}</span>
                      <span className="text-[9px] text-muted-foreground font-medium">{formatTimeAgo(campaign.createdAt)}</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-1 rounded-full",
                      campaign.status === "completed" ? "bg-green-500/10 text-green-600" :
                      campaign.status === "partial" ? "bg-yellow-500/10 text-yellow-600" :
                      campaign.status === "running" ? "bg-blue-500/10 text-blue-600" :
                      campaign.status === "scheduled" ? "bg-purple-500/10 text-purple-600" :
                      "bg-orange-500/10 text-orange-600"
                    )}>
                      {campaign.status === "partial" ? "Partial" : campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
