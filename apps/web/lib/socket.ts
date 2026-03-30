import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

function isExpectedSocketError(error: any): boolean {
  const message = String(error?.message || error || "").toLowerCase();
  const description = String(error?.description || "").toLowerCase();

  return (
    message.includes("websocket error") ||
    message.includes("xhr poll error") ||
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    description.includes("ecconnrefused") ||
    description.includes("fetch failed")
  );
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Create socket instance if not exists
    if (!socketInstance) {
      // Prefer an explicitly configured API origin; otherwise stay on the current origin.
      const apiUrl = typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin)
        : "http://127.0.0.1:3001";

      // Get session ID from cookie to send with socket connection
      const sessionId = typeof document !== "undefined"
        ? document.cookie.split('; ').find(c => c.startsWith('session_id='))?.split('=')[1]
        : undefined;

      console.log("[Socket] Connecting to:", apiUrl, "with sessionId:", sessionId?.substring(0, 8) + "...");

      socketInstance = io(apiUrl, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        // Pass session ID explicitly for cross-domain authentication
        auth: {
          sessionId: sessionId,
        },
      });
    }

    setSocket(socketInstance);

    // Handle connection
    socketInstance.on("connect", () => {
      console.log("[Socket] Connected:", socketInstance?.id);
      setConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      if (isExpectedSocketError(error)) {
        console.warn("[Socket] Backend not ready for realtime connection yet");
        return;
      }
      console.error("[Socket] Connection error:", error);
    });

    // Cleanup on unmount
    return () => {
      // Don't disconnect - keep instance alive for other components
    };
  }, []);

  return { socket, connected };
}

// Helper to join user room (call after getting userId)
export function joinUserRoom(socket: Socket | null, userId: string) {
  if (socket && socket.connected) {
    socket.emit("join_user", userId);
    console.log("[Socket] Joined user room:", userId);
  }
}

// Helper to join conversation room
export function joinConversationRoom(socket: Socket | null, conversationId: string) {
  if (socket && socket.connected) {
    socket.emit("join_conversation", conversationId);
    console.log("[Socket] Joined conversation room:", conversationId);
  }
}

// Helper to leave conversation room
export function leaveConversationRoom(socket: Socket | null, conversationId: string) {
  if (socket && socket.connected) {
    socket.emit("leave_conversation", conversationId);
  }
}

// Export singleton instance for direct access
export { socketInstance };
