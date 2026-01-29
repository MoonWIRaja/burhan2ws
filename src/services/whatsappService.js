import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  delay,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getPrisma } from '../config/database.js';
import QRCode from 'qrcode-terminal';
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';

// Helper functions to use global.io
function emitToSession(sessionId, event, data) {
  if (global.io) {
    global.io.to(`session:${sessionId}`).emit(event, data);
  }
}

function broadcast(event, data) {
  if (global.io) {
    global.io.emit(event, data);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store active sessions
const sessions = new Map();

/**
 * Get sessions directory path
 */
function getSessionsDir() {
  const sessionsDir = process.env.WA_SESSIONS_DIR || '.wa-sessions';
  const fullPath = join(dirname(dirname(__filename)), sessionsDir);

  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }

  return fullPath;
}

/**
 * Create WhatsApp socket for a session
 */
export async function createSession(sessionId) {
  if (sessions.has(sessionId)) {
    console.log(`Session ${sessionId} already exists`);
    return sessions.get(sessionId);
  }

  const logger = pino({ level: 'silent' });
  const sessionsDir = getSessionsDir();

  try {
    // Fetch latest Baileys version to avoid 405 errors
    const { version } = await fetchLatestBaileysVersion();

    const { state, saveCreds } = await useMultiFileAuthState(
      join(sessionsDir, sessionId)
    );

    const socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ['Burhan2WS', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      // Additional options to prevent 405 errors
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 30000
    });

    // Store session
    sessions.set(sessionId, {
      socket,
      state,
      saveCreds,
      qrCode: null
    });

    // Create or update session in database
    await getPrisma().session.upsert({
      where: { sessionId },
      update: { status: 'connecting' },
      create: {
        sessionId,
        status: 'connecting'
      }
    });

    // Set up event handlers
    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrCodeData = qr;

        // Display QR in terminal for testing
        console.log(`\n📱 QR Code for session ${sessionId}:`);
        QRCode.generate(qrCodeData, { small: true });

        // Update session in database
        await getPrisma().session.update({
          where: { sessionId },
          data: {
            qrCode: qrCodeData,
            status: 'qr'
          }
        });

        // Emit QR code to connected clients
        emitToSession(sessionId, 'qr', {
          sessionId,
          qr: qrCodeData
        });

        // Store QR in session
        const session = sessions.get(sessionId);
        if (session) {
          session.qrCode = qrCodeData;
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`Connection closed for session ${sessionId}:`, lastDisconnect.error);

        // Handle error 515 - Stream Errored (corrupted session)
        if (statusCode === 515) {
          console.log(`⚠️  Session ${sessionId} corrupted (error 515), cleaning up...`);

          // Delete corrupted session files
          const { rm } = await import('fs/promises');
          const sessionsDir = getSessionsDir();
          const sessionPath = join(sessionsDir, sessionId);

          try {
            await rm(sessionPath, { recursive: true, force: true });
            console.log(`✅ Deleted corrupted session files for ${sessionId}`);
          } catch (err) {
            console.error(`❌ Error deleting session files:`, err.message);
          }

          // Update database status
          await getPrisma().session.update({
            where: { sessionId },
            data: {
              status: 'disconnected',
              lastActive: new Date(),
              qrCode: null
            }
          });

          // Emit error to frontend
          emitToSession(sessionId, 'connection-error', {
            sessionId,
            error: 'Session corrupted. Please scan QR code again.',
            code: 515
          });

          // Remove from memory
          sessions.delete(sessionId);

          // Auto-recreate for new QR
          console.log(`🔄 Recreating session ${sessionId} for new QR...`);
          await delay(2000);
          createSession(sessionId);
          return;
        }

        // Update session status
        await getPrisma().session.update({
          where: { sessionId },
          data: {
            status: shouldReconnect ? 'reconnecting' : 'disconnected',
            lastActive: new Date()
          }
        });

        // Emit status update
        emitToSession(sessionId, 'connection-status', {
          sessionId,
          status: shouldReconnect ? 'reconnecting' : 'disconnected'
        });

        // Remove session from memory
        sessions.delete(sessionId);

        // Reconnect if needed (with exponential backoff for repeated errors)
        if (shouldReconnect) {
          console.log(`Reconnecting session ${sessionId}...`);
          await delay(process.env.WA_RECONNECT_INTERVAL || 30000);
          createSession(sessionId);
        }
      } else if (connection === 'open') {
        console.log(`Connection opened for session ${sessionId}`);

        // Get phone number
        const user = socket.user;
        const phoneNumber = user?.id?.split(':')[0];

        // Update session in database
        await getPrisma().session.update({
          where: { sessionId },
          data: {
            status: 'connected',
            phoneNumber: phoneNumber,
            lastActive: new Date(),
            qrCode: null
          }
        });

        // Emit status update
        emitToSession(sessionId, 'connection-status', {
          sessionId,
          status: 'connected',
          phoneNumber
        });

        broadcast('session-connected', {
          sessionId,
          status: 'connected',
          phoneNumber
        });
      }
    });

    // Handle incoming messages
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const message of messages) {
          await handleIncomingMessage(sessionId, message);
        }
      }
    });

    // Handle message updates (delivery receipts)
    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.update.status) {
          await updateMessageStatus(sessionId, update.key.id, update.update.status);
        }
      }
    });

    return socket;
  } catch (error) {
    console.error(`Error creating session ${sessionId}:`, error);
    await getPrisma().session.update({
      where: { sessionId },
      data: {
        status: 'error',
        lastActive: new Date()
      }
    });
    throw error;
  }
}

/**
 * Handle incoming message
 */
async function handleIncomingMessage(sessionId, message) {
  try {
    const messageContent = message.message;
    if (!messageContent) return;

    const messageType = Object.keys(messageContent)[0];
    let content = null;

    // Extract message content based on type
    if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
      content = messageContent.conversation || messageContent.extendedTextMessage?.text;
    } else if (messageType === 'imageMessage') {
      content = messageContent.imageMessage?.caption || '[Image]';
    } else if (messageType === 'videoMessage') {
      content = messageContent.videoMessage?.caption || '[Video]';
    } else if (messageType === 'audioMessage') {
      content = '[Audio]';
    } else if (messageType === 'documentMessage') {
      content = messageContent.documentMessage?.caption || '[Document]';
    }

    // Save message to database
    const dbMessage = await getPrisma().message.create({
      data: {
        sessionId,
        messageId: message.key.id,
        from: message.key.remoteJid,
        to: message.key.fromMe ? message.key.remoteJid : null,
        content,
        messageType,
        timestamp: new Date(message.messageTimestamp * 1000),
        status: 'delivered',
        direction: 'inbound'
      }
    });

    // Emit message to connected clients
    emitToSession(sessionId, 'new-message', {
      id: dbMessage.id,
      sessionId,
      messageId: dbMessage.messageId,
      from: dbMessage.from,
      to: dbMessage.to,
      content: dbMessage.content,
      messageType: dbMessage.messageType,
      timestamp: dbMessage.timestamp,
      status: dbMessage.status,
      direction: dbMessage.direction
    });
  } catch (error) {
    console.error(`Error handling incoming message:`, error);
  }
}

/**
 * Update message status
 */
async function updateMessageStatus(sessionId, messageId, status) {
  try {
    const statusMap = {
      0: 'pending',
      1: 'sent',
      2: 'delivered',
      3: 'read'
    };

    await getPrisma().message.updateMany({
      where: {
        sessionId,
        messageId
      },
      data: {
        status: statusMap[status] || 'unknown'
      }
    });

    emitToSession(sessionId, 'message-status', {
      sessionId,
      messageId,
      status: statusMap[status]
    });
  } catch (error) {
    console.error(`Error updating message status:`, error);
  }
}

/**
 * Send message
 */
export async function sendMessage(sessionId, to, content, messageType = 'text') {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const { socket } = session;

  // Save message to database first
  const dbMessage = await getPrisma().message.create({
    data: {
      sessionId,
      messageId: uuidv4(),
      from: socket.user?.id || 'system',
      to,
      content,
      messageType,
      timestamp: new Date(),
      status: 'pending',
      direction: 'outbound'
    }
  });

  try {
    // Send message via WhatsApp
    const sent = await socket.sendMessage(to, {
      text: content
    });

    // Update message with actual WhatsApp message ID
    await getPrisma().message.update({
      where: { id: dbMessage.id },
      data: {
        messageId: sent.key.id,
        status: 'sent'
      }
    });

    // Emit message sent event
    emitToSession(sessionId, 'message-sent', {
      id: dbMessage.id,
      sessionId,
      messageId: sent.key.id,
      to,
      content,
      messageType,
      timestamp: dbMessage.timestamp,
      status: 'sent',
      direction: 'outbound'
    });

    return {
      success: true,
      messageId: sent.key.id,
      dbMessageId: dbMessage.id
    };
  } catch (error) {
    // Update message status to failed
    await getPrisma().message.update({
      where: { id: dbMessage.id },
      data: {
        status: 'failed'
      }
    });

    throw error;
  }
}

/**
 * Disconnect session
 */
export async function disconnectSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const { socket } = session;
  await socket.logout();

  // Update session in database
  await getPrisma().session.update({
    where: { sessionId },
    data: {
      status: 'disconnected',
      lastActive: new Date()
    }
  });

  // Remove from memory
  sessions.delete(sessionId);

  // Emit status update
  emitToSession(sessionId, 'connection-status', {
    sessionId,
    status: 'disconnected'
  });

  return { success: true };
}

/**
 * Get session info
 */
export function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Get all sessions
 */
export function getAllSessions() {
  return Array.from(sessions.keys());
}

/**
 * Initialize WhatsApp service
 */
export async function initWhatsApp() {
  try {
    // Load existing sessions from database and reconnect
    const existingSessions = await getPrisma().session.findMany({
      where: {
        status: {
          in: ['connected', 'reconnecting']
        }
      }
    });

    console.log(`Found ${existingSessions.length} existing sessions to reconnect`);

    for (const session of existingSessions) {
      console.log(`Reconnecting session: ${session.sessionId}`);
      await createSession(session.sessionId);
      await delay(2000); // Stagger reconnections
    }

    console.log('✅ WhatsApp service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp service:', error);
  }
}
