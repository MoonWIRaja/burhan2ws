import { Server } from "socket.io";
import path from "path";
import fs from "fs/promises";
import { createWriteStream, WriteStream } from "fs";

// Parse cookies from a cookie string
function parseCookies(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieString) return cookies;
  cookieString.split(";").forEach((cookie) => {
    const [key, ...values] = cookie.trim().split("=");
    if (key && values.length > 0) {
      cookies[key] = values.join("=");
    }
  });
  return cookies;
}

// Store active uploads: uploadId -> { filePath, fileSize, bytesReceived, fileName, mimeType }
const activeUploads = new Map<string, {
  filePath: string;
  fileSize: number;
  bytesReceived: number;
  fileName: string;
  mimeType: string; // Store original mimetype for proper sending
  writeStream: WriteStream | null;
}>();

export function setupSocketHandlers(io: Server) {
  // Middleware for authentication - runs on every connection
  io.use((socket: any, next) => {
    const sessionId = socket.handshake.auth?.sessionId
      || socket.handshake.query?.auth
      || parseCookies(socket.handshake.headers?.cookie || "")["session_id"];

    if (!sessionId) {
      console.log(`[Socket] Connection rejected: No session ID`);
      return next(new Error("Unauthorized: No session ID"));
    }

    // Attach sessionId to socket for use in handlers
    socket.sessionId = sessionId;
    console.log(`[Socket] Connection accepted: ${socket.id} with session: ${sessionId}`);
    next();
  });

  io.on("connection", (socket: any) => {
    console.log(`🔌 Client connected: ${socket.id} (session: ${socket.sessionId})`);

    // Join user-specific room for targeted events
    socket.on("join_user", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`📱 User ${userId} joined their room`);
    });

    // Leave user room
    socket.on("leave_user", (userId: string) => {
      socket.leave(`user:${userId}`);
    });

    // Join session room for WhatsApp auth events (used by login page)
    socket.on("join_session", (data: { sessionId: string }) => {
      const { sessionId } = data;
      socket.join(`session:${sessionId}`);
      console.log(`📱 Session ${sessionId} joined their room`);
    });

    // Leave session room
    socket.on("leave_session", (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
    });

    // Join conversation room for real-time chat
    socket.on("join_conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("leave_conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ========== FILE UPLOAD VIA WEBSOCKET - EVENT BASED ==========
    // Initialize upload - client provides uploadId, server confirms
    socket.on("upload_init", async (data: { uploadId: string; fileName: string; fileSize: number; fileType: string }) => {
      try {
        console.log("[Upload] Init received:", data.uploadId, data.fileName);

        const { uploadId, fileName, fileSize, fileType } = data;

        // Create upload directory
        const uploadDir = path.join(process.env.DATA_PATH || "./data", "uploads");
        await fs.mkdir(uploadDir, { recursive: true });

        // Generate filename
        const ext = path.extname(fileName);
        const uniqueFileName = `media-${Date.now()}-${Math.random().toString(36).substring(2, 11)}${ext}`;
        const filePath = path.join(uploadDir, uniqueFileName);

        // Create write stream
        const writeStream = createWriteStream(filePath);

        // Store upload info
        activeUploads.set(uploadId, {
          filePath,
          fileSize,
          bytesReceived: 0,
          fileName,
          mimeType: fileType, // Store original mimetype
          writeStream,
        });

        console.log(`[Upload] Init complete: ${fileName} -> ${uploadId}, file created: ${uniqueFileName}`);

        // Send ready event to client IMMEDIATELY
        socket.emit("upload_init_confirm", { uploadId, ready: true });
        console.log(`[Upload] Sent init_confirm for ${uploadId}`);
      } catch (error) {
        console.error("[Upload] Init error:", error);
        socket.emit("upload_init_confirm", { uploadId: data.uploadId, ready: false, error: "Failed to initialize" });
      }
    });

    // Receive file chunk - send ACK via event (NOT callback!)
    socket.on("upload_chunk", async (data: { uploadId: string; chunk: string; chunkIndex: number }) => {
      try {
        const { uploadId, chunk, chunkIndex } = data;

        // Quick log
        console.log(`[Upload] Chunk ${chunkIndex} received for ${uploadId}, size: ${(chunk.length / 1024).toFixed(0)}KB`);

        const upload = activeUploads.get(uploadId);

        if (!upload) {
          console.log(`[Upload] ERROR - No upload found for: ${uploadId}`);
          socket.emit("upload_chunk_ack", { uploadId, chunkIndex, success: false });
          return;
        }

        // Decode base64 chunk
        const buffer = Buffer.from(chunk, "base64");

        // Write to file
        if (upload.writeStream && !upload.writeStream.destroyed) {
          // Write synchronously to ensure it completes
          await new Promise<void>((resolveWrite, rejectWrite) => {
            upload.writeStream!.write(buffer, (err) => {
              if (err) rejectWrite(err);
              else resolveWrite();
            });
          });

          upload.bytesReceived += buffer.length;
          const progress = Math.round((upload.bytesReceived / upload.fileSize) * 100);

          console.log(`[Upload] Chunk ${chunkIndex} written, progress: ${progress}%`);

          // Send ACK via event IMMEDIATELY after write
          socket.emit("upload_chunk_ack", { uploadId, chunkIndex, success: true });
          console.log(`[Upload] Sent ACK for chunk ${chunkIndex}`);
        } else {
          console.log(`[Upload] ERROR - Stream closed for: ${uploadId}`);
          socket.emit("upload_chunk_ack", { uploadId, chunkIndex, success: false });
        }
      } catch (error) {
        console.error("[Upload] Chunk error:", error);
        socket.emit("upload_chunk_ack", { uploadId: data.uploadId, chunkIndex: data.chunkIndex, success: false });
      }
    });

    // Complete upload - send result via event
    socket.on("upload_complete", async (data: { uploadId: string }) => {
      try {
        const { uploadId } = data;
        const upload = activeUploads.get(uploadId);

        if (!upload) {
          console.log(`[Upload] Complete failed - no upload: ${uploadId}`);
          socket.emit("upload_complete", { uploadId, success: false, error: "Invalid upload ID" });
          return;
        }

        // Close write stream
        if (upload.writeStream) {
          await new Promise<void>((resolve, reject) => {
            upload.writeStream!.end((err: Error | null | undefined) => err ? reject(err) : resolve());
          });
        }

        // Get media type
        const ext = path.extname(upload.fileName);
        let mediaType = "document";
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(ext)) mediaType = "image";
        else if (/\.(mp4|mov|avi)$/i.test(ext)) mediaType = "video";

        // Return file info
        const url = `/uploads/${path.basename(upload.filePath)}`;

        console.log(`[Upload] Complete: ${upload.fileName} -> ${url}`);

        // Clean up
        activeUploads.delete(uploadId);

        // Send result via event
        socket.emit("upload_complete", {
          uploadId,
          success: true,
          url,
          type: mediaType,
          mimeType: upload.mimeType, // Include original mimetype for proper WhatsApp sending
          name: upload.fileName,
          size: upload.bytesReceived,
        });
      } catch (error) {
        console.error("[Upload] Complete error:", error);
        socket.emit("upload_complete", { uploadId: data.uploadId, success: false, error: "Failed to complete upload" });
      }
    });

    // Cancel upload
    socket.on("upload_cancel", (data: { uploadId: string }) => {
      const { uploadId } = data;
      const upload = activeUploads.get(uploadId);

      if (upload) {
        if (upload.writeStream) {
          upload.writeStream.destroy();
        }
        // Delete partial file
        fs.unlink(upload.filePath).catch(() => {});
        activeUploads.delete(uploadId);
        console.log(`[Upload] Cancelled: ${uploadId}`);
      }

      socket.emit("upload_cancelled", { uploadId });
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      // Clean up any uploads from this socket
      for (const [_uploadId, upload] of activeUploads.entries()) {
        if (upload.writeStream) {
          upload.writeStream.destroy();
        }
        fs.unlink(upload.filePath).catch(() => {});
      }
      activeUploads.clear();
    });
  });
}

// Helper functions for emitting events
export function emitToUser(io: Server, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToConversation(io: Server, conversationId: string, event: string, data: any) {
  io.to(`conversation:${conversationId}`).emit(event, data);
}

// Event types for real-time updates
export const SocketEvents = {
  // WhatsApp connection
  WHATSAPP_QR: "whatsapp_qr",
  WHATSAPP_CONNECTED: "whatsapp_connected",
  WHATSAPP_DISCONNECTED: "whatsapp_disconnected",

  // Messages
  MESSAGE_RECEIVED: "message_received",
  MESSAGE_STATUS: "message_status",

  // Campaigns
  CAMPAIGN_PROGRESS: "campaign_progress",
  CAMPAIGN_COMPLETED: "campaign_completed",

  // Bot
  BOT_STATUS_CHANGED: "bot_status_changed",

  // Sandbox
  SANDBOX_RESPONSE: "sandbox_response",
};
