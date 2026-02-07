"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { IconRefresh, IconCheck, IconX, IconPlugConnected } from "@tabler/icons-react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";

// Helper to get session ID from cookie
function getSessionId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
}

// Get Socket.io server URL
// Priority: NEXT_PUBLIC_API_URL env var -> construct from window.location -> localhost:3001
function getSocketUrl(): string {
  if (typeof window === "undefined") return "http://localhost:3001";

  // Try environment variable first (inlined at build time)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl !== "http://localhost:3001") {
    console.log("[Login] Using NEXT_PUBLIC_API_URL:", envUrl);
    return envUrl;
  }

  // Fallback: construct from current location
  // If on dev.owlscottage.com, use api-dev.owlscottage.com
  const hostname = window.location.hostname;
  let socketUrl = "http://localhost:3001";

  if (hostname === "dev.owlscottage.com") {
    socketUrl = "https://api-dev.owlscottage.com";
  } else if (hostname === "owlscottage.com" || hostname === "www.owlscottage.com") {
    socketUrl = "https://api.owlscottage.com";
  } else if (hostname.endsWith(".owlscottage.com")) {
    // Other subdomains: replace subdomain with api
    const parts = hostname.split(".");
    if (parts[0] === "www") {
      parts.shift(); // Remove www
    }
    parts[0] = "api"; // Replace first subdomain with api
    socketUrl = `https://${parts.join(".")}`;
  }

  console.log("[Login] Socket URL:", socketUrl, "(env var was:", envUrl + ")");
  return socketUrl;
}

export default function LoginPage() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "waiting" | "connected" | "error" | "backend_offline">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldPollRef = useRef(true);
  const connectRequestedRef = useRef(false);

  useEffect(() => {
    // Get session ID from cookie (set by middleware)
    const sid = getSessionId();
    setSessionId(sid);
  }, []);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    shouldPollRef.current = false;
    connectRequestedRef.current = false; // Reset to allow new connection requests
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  // Handle successful connection
  const handleConnected = useCallback(() => {
    stopPolling();
    setStatus("connected");
    // Set auth cookie for middleware protection
    document.cookie = "wa_connected=true; path=/; max-age=2592000"; // 30 days
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1000);
  }, [stopPolling]);

  // Socket.io connection for real-time WhatsApp status updates
  // IMPORTANT: Only connect AFTER session is created
  useEffect(() => {
    if (!sessionId) return; // Don't connect without session

    const socketUrl = getSocketUrl();
    console.log("[Login] Connecting to Socket.io:", socketUrl, "with session:", sessionId);

    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true, // Send cookies
      auth: {
        sessionId: sessionId, // Send session via auth
      },
    });

    socketRef.current = socket;

    // Listen for WhatsApp connection events
    socket.on("connect", () => {
      console.log("[Login] Socket.io connected:", socket.id);
      // Join session room to receive WhatsApp events for this session
      socket.emit("join_session", { sessionId });
      console.log("[Login] Joined session room:", sessionId);
    });

    socket.on("whatsapp_connected", (data: { phoneNumber?: string }) => {
      console.log("[Login] WhatsApp connected event received:", data);
      handleConnected();
    });

    // Listen for QR updates (when WhatsApp reconnects after timeout, it generates a new QR)
    socket.on("whatsapp_qr", (data: { qr?: string }) => {
      console.log("[Login] WhatsApp QR update received");
      if (data.qr) {
        console.log("[Login] New QR code received, updating...");
        setQrCode(data.qr);
        setStatus("waiting");
      }
    });

    // Handle WhatsApp disconnected event
    // NOTE: During QR phase, 408 timeout is normal (WhatsApp closes connection if QR not scanned quickly)
    // We only show error if we were previously connected, then got disconnected
    socket.on("whatsapp_disconnected", (data: { reason?: string }) => {
      console.log("[Login] WhatsApp disconnected:", data);

      // Only show error if we were already connected before
      // Ignore disconnects during loading/waiting (QR phase) as they're normal
      setStatus((currentStatus) => {
        if (currentStatus === "connected") {
          // We were connected and got disconnected - this is an actual error
          setErrorMessage("WhatsApp disconnected. Please scan QR again.");
          return "error";
        }
        // Still in QR phase, disconnect is normal (408 timeout), keep current status
        console.log("[Login] Disconnect during QR phase, ignoring...");
        return currentStatus;
      });
    });

    socket.on("disconnect", () => {
      console.log("[Login] Socket.io disconnected");
    });

    socket.on("connect_error", (error) => {
      console.error("[Login] Socket.io connection error:", error);
    });

    return () => {
      stopPolling();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handleConnected, sessionId, stopPolling]);

  const initializeConnection = useCallback(async () => {
    try {
      console.log("[Login] Initializing connection...");
      // Stop any existing polling and reset intent
      stopPolling();
      // Reset polling intent for fresh connection attempt
      shouldPollRef.current = true;
      connectRequestedRef.current = false; // Allow new connection request
      setStatus("loading");
      setErrorMessage("");

      // First, ensure we have a session
      const sessionResponse = await fetch("/api/auth/session", {
        credentials: "include",
      });
      const sessionData = await sessionResponse.json();

      console.log("[Login] Session response:", sessionData);

      if (!sessionData.sessionId) {
        setStatus("error");
        setErrorMessage("Failed to create session. Please refresh the page.");
        return;
      }

      // Update local session ID state
      setSessionId(sessionData.sessionId);

      // Use Next.js API proxy (same domain, no CORS issues)
      const healthCheck = await fetch("/api/health", {
        method: "GET",
      }).catch(() => null);

      if (!healthCheck || !healthCheck.ok) {
        console.error("[Login] Health check failed");
        setStatus("backend_offline");
        setErrorMessage("Backend server is offline. Please run 'npm run dev' in terminal.");
        return;
      }

      // Check if already connected
      const statusCheck = await fetch("/api/auth/status", {
        credentials: "include",
      });
      const statusData = await statusCheck.json();

      console.log("[Login] Status check:", statusData);

      if (statusData.connected) {
        console.log("[Login] Already connected, redirecting...");
        handleConnected();
        return;
      }

      // Backend is alive, now try to connect WhatsApp
      const response = await fetch("/api/auth/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const data = await response.json();
      console.log("[Login] Connect response:", { hasQR: !!data.qr, status: data.status, qrLength: data.qr?.length });

      if (data.qr) {
        setQrCode(data.qr);
        setStatus("waiting");
        connectRequestedRef.current = false;
      } else if (data.status === "connected") {
        handleConnected();
        return; // Don't start polling if already connected
      }

      // For any other status (initializing, qr_pending, not_initialized, etc.), start polling
      // The polling logic will handle requesting connection if needed
      if (data.status !== "connected") {
        setStatus("waiting");
        pollForQR();
      }
    } catch (error: any) {
      console.error("[Login] Failed to connect:", error);
      setStatus("backend_offline");
      setErrorMessage("Unable to connect to backend. Make sure the server is running.");
    }
  }, [handleConnected]);

  // Poll for QR code
  const pollForQR = useCallback(async () => {
    // Clear any existing timeout before starting new poll cycle
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    // Reset polling intent when starting a fresh poll cycle
    shouldPollRef.current = true;

    try {
      const response = await fetch("/api/auth/qr", {
        credentials: "include",
      });
      const data = await response.json();

      console.log("[Login] QR poll response:", { hasQR: !!data.qr, status: data.status });

      if (data.qr) {
        setQrCode(data.qr);
        setStatus("waiting");
        connectRequestedRef.current = false; // Reset for next time
      } else if (data.status === "connected") {
        handleConnected();
        connectRequestedRef.current = false;
        return; // Stop polling
      } else if (data.status === "not_initialized" && !connectRequestedRef.current) {
        // Backend not initialized, request connection
        console.log("[Login] Backend not initialized, requesting connection...");
        connectRequestedRef.current = true;
        fetch("/api/auth/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }).then(res => res.json()).then(connectData => {
          console.log("[Login] Connect request response:", connectData);
          if (connectData.qr) {
            setQrCode(connectData.qr);
            setStatus("waiting");
            connectRequestedRef.current = false;
          }
        }).catch(err => {
          console.error("[Login] Connect request error:", err);
          connectRequestedRef.current = false; // Allow retry on error
        });
      }

      // Keep polling if not connected and polling intent is still true
      if (data.status !== "connected" && shouldPollRef.current) {
        pollTimeoutRef.current = setTimeout(() => {
          pollForQR();
        }, 2000);
      }
    } catch (error) {
      console.error("[Login] QR poll error:", error);
      // Don't set error status here, just stop polling
    }
  }, [handleConnected]); // Removed status dependency - use ref instead

  // Stop polling when status changes to error
  useEffect(() => {
    if (status === "error" || status === "backend_offline") {
      stopPolling();
    }
  }, [status, stopPolling]);

  // Initialize connection once on mount
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
      initializeConnection();
    }
  }, [hasInitialized, initializeConnection]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-4">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 text-white mb-4 shadow-lg shadow-green-500/30">
            <IconPlugConnected size={32} />
          </div>
          <h1 className="text-3xl font-bold text-foreground font-display">burhan2ws</h1>
          <p className="text-muted-foreground mt-2">Scan QR code with WhatsApp to login</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-8 shadow-xl">
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground">Connecting to server...</p>
            </div>
          )}

          {status === "backend_offline" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <IconX size={32} className="text-red-500" />
              </div>
              <p className="text-red-500 font-bold mb-2">Server Offline</p>
              <p className="text-sm text-muted-foreground text-center mb-4">{errorMessage}</p>
              <button 
                onClick={initializeConnection}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              >
                <IconRefresh size={16} />
                Retry Connection
              </button>
            </div>
          )}

          {status === "waiting" && (
            <div className="flex flex-col items-center">
              {qrCode ? (
                <>
                  <div className="bg-white p-4 rounded-2xl mb-4 shadow-inner">
                    <img 
                      src={qrCode} 
                      alt="WhatsApp QR Code" 
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                  </p>
                  <button 
                    onClick={initializeConnection}
                    className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    <IconRefresh size={16} />
                    Refresh QR Code
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground">Generating QR code...</p>
                </div>
              )}
            </div>
          )}

          {status === "connected" && (
            <div className="flex flex-col items-center justify-center py-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-4 shadow-lg shadow-green-500/30"
              >
                <IconCheck size={32} className="text-white" />
              </motion.div>
              <p className="text-green-500 font-bold mb-2">Connected!</p>
              <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                <IconX size={32} className="text-orange-500" />
              </div>
              <p className="text-orange-500 font-bold mb-2">Connection Error</p>
              <p className="text-sm text-muted-foreground text-center mb-4">Something went wrong. Please try again.</p>
              <button 
                onClick={initializeConnection}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
              >
                <IconRefresh size={16} />
                Try Again
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your WhatsApp session is securely stored on this device.
        </p>
      </motion.div>
    </div>
  );
}
