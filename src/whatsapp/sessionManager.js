import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prisma from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = pino({ level: 'silent' });

export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  // Get auth state path for session
  getAuthPath(sessionId) {
    return join(__dirname, '../../.wa-sessions', sessionId);
  }

  // Get session by sessionId
  async getSession(sessionId) {
    const session = await prisma.session.findUnique({
      where: { sessionId },
      include: {
        _count: {
          select: { messages: true, files: true }
        }
      }
    });

    if (!session) {
      return null;
    }

    return {
      ...session,
      isActive: this.sessions.has(sessionId)
    };
  }

  // Get all sessions
  async getAllSessions() {
    const sessions = await prisma.session.findMany({
      include: {
        _count: {
          select: { messages: true, files: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return sessions.map(session => ({
      ...session,
      isActive: this.sessions.has(session.sessionId)
    }));
  }

  // Create new session
  async createSession(name) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const session = await prisma.session.create({
      data: {
        sessionId,
        name,
        status: 'disconnected'
      }
    });

    return session;
  }

  // Connect session (start Baileys)
  async connectSession(sessionId, io) {
    try {
      // Check if session already exists in database
      const dbSession = await prisma.session.findUnique({
        where: { sessionId }
      });

      if (!dbSession) {
        console.error(`Session ${sessionId} not found in database`);
        return null;
      }

      // Check if already connected
      if (this.sessions.has(sessionId)) {
        return { status: 'already_connected' };
      }

      // Update status to connecting
      await prisma.session.update({
        where: { sessionId },
        data: { status: 'connecting' }
      });

      // Get auth state
      const { state, saveCreds } = await useMultiFileAuthState(this.getAuthPath(sessionId));

      // Create Baileys socket
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger,
        browser: ['burhan2ws', 'Chrome', '1.0.0']
      });

      // Store session
      this.sessions.set(sessionId, { socket, io });

      // Handle connection updates
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // QR code generated
          const QRCode = await import('qrcode');
          const qrDataUrl = await QRCode.toDataURL(qr);

          await prisma.session.update({
            where: { sessionId },
            data: { status: 'qr', qrCode: qrDataUrl }
          });

          io.emit('session:qr', { sessionId, qrCode: qrDataUrl });
          console.log(`📱 QR Code generated for ${sessionId}`);
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

          if (shouldReconnect) {
            console.log(`🔄 Reconnecting ${sessionId}...`);
            await this.connectSession(sessionId, io);
          } else {
            // Logged out
            console.log(`❌ Session ${sessionId} logged out`);
            this.sessions.delete(sessionId);

            await prisma.session.update({
              where: { sessionId },
              data: { status: 'disconnected', qrCode: null }
            });

            io.emit('session:disconnected', { sessionId });
          }
        } else if (connection === 'open') {
          // Connected successfully
          const phoneNumber = socket.user?.id.split(':')[0];

          await prisma.session.update({
            where: { sessionId },
            data: {
              status: 'connected',
              phoneNumber,
              lastActive: new Date(),
              qrCode: null
            }
          });

          io.emit('session:connected', { sessionId, phoneNumber });
          console.log(`✅ Session ${sessionId} connected as ${phoneNumber}`);
        }
      });

      // Handle incoming messages
      socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const message of messages) {
          if (!message.key.fromMe) {
            const from = message.key.remoteJid;
            const content = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
            const messageType = this.getMessageType(message.message);

            // Save to database
            const savedMessage = await prisma.message.create({
              data: {
                sessionId,
                messageId: message.key.id,
                from,
                to: sessionId,
                content,
                messageType,
                timestamp: new Date(message.messageTimestamp * 1000),
                status: 'delivered',
                direction: 'inbound'
              }
            });

            // Emit via WebSocket
            io.emit('message:received', { sessionId, message: savedMessage });
            io.to(`session:${sessionId}`).emit('message:received', { sessionId, message: savedMessage });

            console.log(`📨 Message received from ${from}`);
          }
        }
      });

      // Handle message updates (read, delivered)
      socket.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
          if (update.update.status) {
            const statusMap = {
              1: 'pending',
              2: 'sent',
              3: 'delivered',
              4: 'read'
            };

            await prisma.message.updateMany({
              where: { messageId: update.key.id },
              data: { status: statusMap[update.update.status] }
            });

            io.emit('message:status', {
              messageId: update.key.id,
              status: statusMap[update.update.status]
            });
          }
        }
      });

      return { status: 'connecting', sessionId };
    } catch (error) {
      console.error(`Error connecting session ${sessionId}:`, error);
      await prisma.session.update({
        where: { sessionId },
        data: { status: 'disconnected' }
      });
      throw error;
    }
  }

  // Disconnect session
  async disconnectSession(sessionId) {
    const sessionData = this.sessions.get(sessionId);

    if (!sessionData) {
      return null;
    }

    try {
      await sessionData.socket.logout();
      this.sessions.delete(sessionId);

      await prisma.session.update({
        where: { sessionId },
        data: { status: 'disconnected', qrCode: null }
      });

      return { status: 'disconnected', sessionId };
    } catch (error) {
      console.error(`Error disconnecting session ${sessionId}:`, error);
      throw error;
    }
  }

  // Delete session
  async deleteSession(sessionId) {
    // Disconnect if connected
    if (this.sessions.has(sessionId)) {
      await this.disconnectSession(sessionId);
    }

    // Delete from database
    await prisma.session.delete({
      where: { sessionId }
    });

    // Delete auth state files
    const fs = await import('fs');
    const authPath = this.getAuthPath(sessionId);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
    }

    return { status: 'deleted', sessionId };
  }

  // Get QR code for session
  async getQRCode(sessionId) {
    const session = await prisma.session.findUnique({
      where: { sessionId }
    });

    if (!session || !session.qrCode) {
      return null;
    }

    return session.qrCode;
  }

  // Get session stats
  async getSessionStats(sessionId) {
    const session = await this.getSession(sessionId);

    if (!session) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [messagesToday, totalMessages, totalFiles] = await Promise.all([
      prisma.message.count({
        where: {
          sessionId,
          createdAt: { gte: today }
        }
      }),
      prisma.message.count({ where: { sessionId } }),
      prisma.file.count({ where: { sessionId } })
    ]);

    return {
      session: {
        id: session.id,
        sessionId: session.sessionId,
        name: session.name,
        phoneNumber: session.phoneNumber,
        status: session.status,
        isActive: session.isActive,
        createdAt: session.createdAt,
        lastActive: session.lastActive
      },
      stats: {
        messagesToday,
        totalMessages,
        totalFiles,
        isActive: session.isActive
      }
    };
  }

  // Get socket for a session
  getSocket(sessionId) {
    const sessionData = this.sessions.get(sessionId);
    return sessionData?.socket;
  }

  // Get message type from Baileys message
  getMessageType(message) {
    if (!message) return 'unknown';

    if (message.conversation) return 'text';
    if (message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.audioMessage) return 'audio';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'sticker';

    return 'unknown';
  }
}

// Export singleton instance
export default new SessionManager();
