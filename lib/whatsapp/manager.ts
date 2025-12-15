import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
  ConnectionState,
  proto,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';
import { prisma } from '../prisma/client';
import { encrypt, decrypt } from '../auth/encryption';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

const logger = pino({ level: 'silent' });
const storeLogger = pino({ level: 'silent' });

// Custom logger for debugging
const debugLog = (msg: string, data?: unknown) => {
  console.log(`[WA-Manager] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
};

export interface WhatsAppConnection {
  socket: WASocket;
  store: ReturnType<typeof makeInMemoryStore>;
  status: 'connecting' | 'connected' | 'disconnected' | 'qr_pending';
  qrCode?: string;
  phone?: string;
}

export type ConnectionEventType = 
  | 'qr'
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'message.update'
  | 'connection.update';

export interface ConnectionEvent {
  type: ConnectionEventType;
  userId: string;
  data: unknown;
}

class WhatsAppManager extends EventEmitter {
  private connections: Map<string, WhatsAppConnection> = new Map();
  private authDir: string;

  constructor() {
    super();
    this.authDir = path.join(process.cwd(), '.wa-sessions');
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  async createConnection(userId: string): Promise<WhatsAppConnection> {
    // Check if connection already exists and is valid
    const existingConn = this.connections.get(userId);
    if (existingConn) {
      // If already connected or waiting for QR, return existing
      if (existingConn.status === 'connected' || existingConn.status === 'qr_pending') {
        debugLog('Returning existing connection', { userId, status: existingConn.status });
        return existingConn;
      }
      // Only close if disconnected
      if (existingConn.status === 'disconnected') {
        await this.closeConnection(userId);
      }
    }

    const userAuthDir = path.join(this.authDir, userId);
    
    // Ensure directory exists
    if (!fs.existsSync(userAuthDir)) {
      fs.mkdirSync(userAuthDir, { recursive: true });
    }
    
    // Try to restore session from database
    await this.restoreSessionFromDB(userId, userAuthDir);

    const { state, saveCreds } = await useMultiFileAuthState(userAuthDir);
    const { version } = await fetchLatestBaileysVersion();

    // Create store for contacts
    const store = makeInMemoryStore({ logger: storeLogger });
    const storeFile = path.join(userAuthDir, 'store.json');
    
    // Try to load existing store
    try {
      if (fs.existsSync(storeFile)) {
        store.readFromFile(storeFile);
      }
    } catch (err) {
      // Ignore store read errors
    }

    const socket = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      syncFullHistory: true, // Enable to get contacts
      markOnlineOnConnect: true,
      getMessage: async (key) => {
        // Get message from store if available
        if (store) {
          const msg = await store.loadMessage(key.remoteJid!, key.id!);
          return msg?.message || undefined;
        }
        return undefined;
      },
    });

    // Bind store to socket events
    store.bind(socket.ev);

    // Save store periodically
    const saveStoreInterval = setInterval(() => {
      try {
        store.writeToFile(storeFile);
      } catch (err) {
        // Ignore store write errors
      }
    }, 30000); // Save every 30 seconds

    const connection: WhatsAppConnection = {
      socket,
      store,
      status: 'connecting',
    };

    this.connections.set(userId, connection);

    // Handle connection events
    socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection: connState, lastDisconnect, qr } = update;
      
      debugLog('Connection update', { userId, connState, hasQR: !!qr });

      if (qr) {
        debugLog('QR Code received', { userId });
        connection.status = 'qr_pending';
        connection.qrCode = qr;
        this.emit('qr', { userId, qr });

        // Save QR to database
        await this.updateSessionInDB(userId, {
          status: 'QR_PENDING',
          qrCode: qr,
        });
      }

      if (connState === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        debugLog('Connection closed', { userId, statusCode, shouldReconnect });

        connection.status = 'disconnected';
        this.emit('disconnected', { userId, shouldReconnect });

        await this.updateSessionInDB(userId, {
          status: 'DISCONNECTED',
          qrCode: null,
        });

        if (shouldReconnect) {
          // Reconnect after a longer delay to prevent rapid reconnects
          setTimeout(() => {
            // Only reconnect if not already reconnected
            const currentConn = this.connections.get(userId);
            if (!currentConn || currentConn.status === 'disconnected') {
              debugLog('Attempting reconnect', { userId });
              this.connections.delete(userId); // Clear old connection
              this.createConnection(userId);
            }
          }, 10000); // 10 second delay
        } else {
          // Logged out, clear session
          await this.clearSession(userId);
        }
      } else if (connState === 'open') {
        debugLog('Connection OPEN - WhatsApp connected!', { userId });
        
        connection.status = 'connected';
        connection.qrCode = undefined;
        
        const phone = socket.user?.id.split(':')[0] || socket.user?.id.split('@')[0];
        connection.phone = phone;
        
        debugLog('Phone extracted', { userId, phone });

        // Handle user merge if phone already exists
        let finalUserId = userId;
        try {
          const existingUserWithPhone = await prisma.user.findFirst({
            where: { phone },
          });
          
          if (existingUserWithPhone && existingUserWithPhone.id !== userId) {
            debugLog('Found existing user with same phone, merging...', { 
              oldUserId: userId, 
              existingUserId: existingUserWithPhone.id,
              phone 
            });
            
            // Transfer this connection to the existing user
            finalUserId = existingUserWithPhone.id;
            
            // Move connection to existing user's ID
            this.connections.delete(userId);
            this.connections.set(finalUserId, connection);
            
            // Update existing user
            await prisma.user.update({
              where: { id: finalUserId },
              data: { 
                status: 'ACTIVE',
                lastLoginAt: new Date(),
              },
            });
            
            // Delete temp user's session first (to avoid FK constraint)
            try {
              await prisma.whatsAppSession.deleteMany({ 
                where: { userId: userId } 
              });
              debugLog('Deleted temp user session', { userId });
            } catch (e) {
              debugLog('Could not delete temp session', { error: (e as Error).message });
            }
            
            // Delete the temporary user
            try {
              await prisma.user.delete({ where: { id: userId } });
              debugLog('Deleted temporary user', { userId });
            } catch (e) {
              debugLog('Could not delete temp user', { error: (e as Error).message });
            }
            
            debugLog('User merged successfully', { finalUserId, phone });
          } else {
            // No existing user, update current user
            await prisma.user.update({
              where: { id: userId },
              data: { 
                phone,
                status: 'ACTIVE',
                lastLoginAt: new Date(),
              },
            });
            debugLog('User updated with phone', { userId, phone });
          }
        } catch (err) {
          debugLog('Error handling user', { error: (err as Error).message });
        }

        // Emit connected event with final user ID
        this.emit('connected', { userId: finalUserId, phone, originalUserId: userId });

        // Update session in database
        await this.updateSessionInDB(finalUserId, {
          status: 'CONNECTED',
          qrCode: null,
          phone,
          lastConnected: new Date(),
        });
        
        debugLog('Database updated to CONNECTED', { finalUserId, phone });

        // Save session to database - copy to new location if merged
        const finalAuthDir = path.join(this.authDir, finalUserId);
        if (finalUserId !== userId && fs.existsSync(userAuthDir)) {
          // Copy session files to new user directory
          try {
            if (!fs.existsSync(finalAuthDir)) {
              fs.mkdirSync(finalAuthDir, { recursive: true });
            }
            const files = fs.readdirSync(userAuthDir);
            for (const file of files) {
              fs.copyFileSync(
                path.join(userAuthDir, file),
                path.join(finalAuthDir, file)
              );
            }
            // Clean up old directory
            fs.rmSync(userAuthDir, { recursive: true, force: true });
            debugLog('Session files moved to new user', { from: userId, to: finalUserId });
          } catch (e) {
            debugLog('Error moving session files', { error: (e as Error).message });
          }
        }
        await this.saveSessionToDB(finalUserId, finalAuthDir);
        
        // Auto-import contacts from WhatsApp
        setTimeout(async () => {
          await this.importContactsFromWhatsApp(finalUserId, socket);
        }, 3000); // Wait 3 seconds for connection to stabilize
      }
    });

    // Handle initial contacts set from WhatsApp (full contact list)
    // DISABLED: Auto-save contacts from WhatsApp
    // Contacts should only be created manually by user
    socket.ev.on('contacts.set' as any, async (data: any) => {
      // DO NOT auto-create contacts from WhatsApp
      // User must manually add contacts through the UI
      debugLog('Contacts SET received (ignored - auto-save disabled)', { userId, count: (data?.contacts as any[])?.length || 0 });
      return;
    });

    // DISABLED: Auto-save contacts from WhatsApp
    // Contacts should only be created manually by user
    socket.ev.on('contacts.update', async (contacts) => {
      // DO NOT auto-create contacts from WhatsApp
      // User must manually add contacts through the UI
      debugLog('Contacts update received (ignored - auto-save disabled)', { userId, count: contacts.length });
      return;
    });

    // Handle chats set (to extract contacts from chat list)
    socket.ev.on('chats.set' as any, async (data: any) => {
      const chats = (data?.chats as any[]) || [];
      debugLog('Chats SET received', { userId, count: chats.length });
      
      const currentConn = this.connections.get(userId);
      const targetUserId = currentConn ? userId : Array.from(this.connections.keys()).find(k => 
        this.connections.get(k)?.phone === socket.user?.id?.split(':')[0]
      ) || userId;
      
      for (const chat of chats) {
        if (!chat.id?.endsWith('@s.whatsapp.net')) continue;
        
        const phone = chat.id.split('@')[0];
        const name = chat.name || '';
        
        if (!phone || phone.length < 8) continue;
        
        try {
          await prisma.contact.upsert({
            where: {
              userId_phone: { userId: targetUserId, phone },
            },
            create: {
              userId: targetUserId,
              phone,
              name: name || undefined,
              autoSaved: true,
            },
            update: name ? { name } : {},
          });
        } catch (err) {
          // Ignore errors
        }
      }
    });

    // Save credentials on update
    socket.ev.on('creds.update', async () => {
      try {
        // Ensure directory exists before saving
        if (!fs.existsSync(userAuthDir)) {
          fs.mkdirSync(userAuthDir, { recursive: true });
        }
        await saveCreds();
        await this.saveSessionToDB(userId, userAuthDir);
      } catch (error) {
        console.error('[WA-Manager] Error saving credentials:', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          userAuthDir,
          dirExists: fs.existsSync(userAuthDir)
        });
        // Try to create directory and retry
        try {
          if (!fs.existsSync(userAuthDir)) {
            fs.mkdirSync(userAuthDir, { recursive: true });
            await saveCreds();
            await this.saveSessionToDB(userId, userAuthDir);
          }
        } catch (retryError) {
          console.error('[WA-Manager] Retry failed:', retryError);
        }
      }
    });

    // Handle incoming messages - also save contacts automatically
    socket.ev.on('messages.upsert', async (m) => {
      // Get the correct userId (might have been merged)
      const currentConn = this.connections.get(userId);
      const targetUserId = currentConn ? userId : Array.from(this.connections.keys()).find(k => 
        this.connections.get(k)?.phone === socket.user?.id?.split(':')[0]
      ) || userId;

      for (const message of m.messages) {
        const remoteJid = message.key.remoteJid;
        
        // DISABLED: Auto-save contact from incoming messages
        // Contacts must be manually added by user or synced via "Sync from WhatsApp" button
        // This prevents unwanted contacts from groups or random numbers

        // Handle ALL messages - both incoming and outgoing (from phone)
        // Skip status messages
        if (remoteJid && (remoteJid.includes('status@broadcast') || remoteJid.includes('status@'))) {
          continue;
        }

        // Check if message has content (text, media, sticker, etc)
        const hasMessage = !!message.message;
        if (!hasMessage) {
          console.log('[WA-Manager] Skipping message without message object:', {
            remoteJid,
            messageId: message.key.id,
            fromMe: message.key.fromMe
          });
          continue;
        }

        const msgType = this.getMessageType(message);
        const hasContent = !!this.extractMessageContent(message) ||
          !!message.message?.imageMessage ||
          !!message.message?.videoMessage ||
          !!message.message?.audioMessage ||
          !!message.message?.documentMessage ||
          !!message.message?.stickerMessage ||
          !!message.message?.contactMessage ||
          !!message.message?.locationMessage;

        // Skip protocol messages without content
        if (msgType === 'protocol' && !hasContent) {
          continue;
        }

        // Process message if it has content (both fromMe and !fromMe)
        if (hasContent) {
          console.log('[WA-Manager] Message received:', {
            from: message.key.remoteJid,
            type: msgType,
            hasContent: true,
            messageType: m.type, // 'notify' or 'append'
            fromMe: message.key.fromMe,
            messageId: message.key.id
          });
          
          try {
            this.emit('message', { userId: targetUserId, message });
            await this.handleIncomingMessage(targetUserId, message);
          } catch (error) {
            console.error('[WA-Manager] Error handling message:', {
              error: error instanceof Error ? error.message : String(error),
              messageId: message.key.id,
              remoteJid: message.key.remoteJid
            });
          }
        } else {
          console.log('[WA-Manager] Skipping message without content:', {
            from: message.key.remoteJid,
            type: msgType,
            hasContent: false,
            fromMe: message.key.fromMe
          });
        }
      }
    });

    // Handle message status updates
    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        this.emit('message.update', { userId, update });
        await this.handleMessageUpdate(userId, update);
      }
    });

    return connection;
  }

  async getSocket(userId: string): Promise<WASocket | null> {
    // First try to get socket for specific userId
    const connection = this.connections.get(userId);
    if (connection?.status === 'connected') {
      return connection.socket;
    }
    
    // If not found, try to find any connected socket (for merged users)
    for (const [connUserId, conn] of this.connections) {
      if (conn.status === 'connected') {
        debugLog('Using socket from different user (merged)', { requestedUserId: userId, actualUserId: connUserId });
        return conn.socket;
      }
    }
    
    return null;
  }

  async getConnection(userId: string): Promise<WhatsAppConnection | null> {
    return this.connections.get(userId) || null;
  }

  getAllConnections(): Map<string, WhatsAppConnection> {
    return this.connections;
  }

  async closeConnection(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection) {
      connection.socket.end(undefined);
      this.connections.delete(userId);
    }
  }

  async clearSession(userId: string): Promise<void> {
    await this.closeConnection(userId);
    
    const userAuthDir = path.join(this.authDir, userId);
    if (fs.existsSync(userAuthDir)) {
      fs.rmSync(userAuthDir, { recursive: true, force: true });
    }

    // Clear from database
    await prisma.whatsAppSession.deleteMany({
      where: { userId },
    });
  }

  async logout(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (connection?.socket) {
      await connection.socket.logout();
    }
    await this.clearSession(userId);
  }

  private async restoreSessionFromDB(userId: string, authDir: string): Promise<boolean> {
    try {
      const session = await prisma.whatsAppSession.findUnique({
        where: { userId },
      });

      if (!session?.sessionData) return false;

      // Decrypt and parse session data
      const decrypted = decrypt(session.sessionData);
      const sessionFiles = JSON.parse(decrypted);

      // Ensure directory exists
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      // Write session files
      for (const [filename, content] of Object.entries(sessionFiles)) {
        const filePath = path.join(authDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(content));
      }

      return true;
    } catch (error) {
      console.error('Failed to restore session from DB:', error);
      return false;
    }
  }

  private async saveSessionToDB(userId: string, authDir: string): Promise<void> {
    try {
      if (!fs.existsSync(authDir)) return;

      // Ensure user exists to avoid FK constraint error
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userExists) {
        debugLog('User not found, skipping saveSessionToDB', { userId });
        return;
      }

      const files = fs.readdirSync(authDir);
      const sessionFiles: Record<string, unknown> = {};

      for (const file of files) {
        const filePath = path.join(authDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        try {
          sessionFiles[file] = JSON.parse(content);
        } catch {
          sessionFiles[file] = content;
        }
      }

      const encrypted = encrypt(JSON.stringify(sessionFiles));

      try {
        await prisma.whatsAppSession.upsert({
          where: { userId },
          create: {
            userId,
            sessionData: encrypted,
            status: 'CONNECTED',
          },
          update: {
            sessionData: encrypted,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2003') {
          debugLog('FK error saving session, skipping', { userId });
          return;
        }
        if (err?.code === 'P1017') {
          debugLog('DB connection closed while saving session, skipping this attempt', { userId });
          return;
        }
        throw err;
      }
    } catch (error) {
      console.error('Failed to save session to DB:', error);
    }
  }

  private async updateSessionInDB(
    userId: string,
    data: {
      status?: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QR_PENDING' | 'LOGGED_OUT';
      qrCode?: string | null;
      phone?: string;
      lastConnected?: Date;
    }
  ): Promise<void> {
    try {
      // First check if user exists to avoid FK constraint error
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      
      if (!userExists) {
        debugLog('User not found, skipping session update', { userId });
        return;
      }
      
      await prisma.whatsAppSession.upsert({
        where: { userId },
        create: {
          userId,
          sessionData: '',
          ...data,
        },
        update: data,
      });
    } catch (error) {
      // Silently ignore errors - don't crash server
      debugLog('Failed to update session in DB (non-fatal)', { userId, error: (error as Error).message });
    }
  }

  private async handleIncomingMessage(
    userId: string,
    message: proto.IWebMessageInfo
  ): Promise<void> {
    try {
      const remoteJid = message.key.remoteJid;
      if (!remoteJid) {
        console.log('[WA-Manager] No remoteJid in message');
        return;
      }

      // FILTER OUT STATUS MESSAGES, CHANNELS, AND BROADCASTS - Only save actual chats
      // Status updates
      if (remoteJid.includes('status@broadcast') || remoteJid.includes('status@')) {
        console.log('[WA-Manager] Skipping status message from:', remoteJid);
        return;
      }
      
      // Newsletter channels (WhatsApp channels)
      if (remoteJid.includes('@news')) {
        console.log('[WA-Manager] Skipping channel/newsletter message from:', remoteJid);
        return;
      }
      
      // Broadcast lists
      if (remoteJid.includes('@broadcast')) {
        console.log('[WA-Manager] Skipping broadcast message from:', remoteJid);
        return;
      }

      const phone = remoteJid.split('@')[0];
      const isGroup = remoteJid.endsWith('@g.us');
      const messageContent = this.extractMessageContent(message);
      const messageType = this.getMessageType(message);

      console.log('[WA-Manager] Processing incoming message:', {
        remoteJid,
        phone,
        isGroup,
        type: messageType,
        hasContent: !!messageContent,
        fromMe: message.key.fromMe
      });

      // Skip groups entirely (we only handle personal chats)
      if (isGroup) {
        console.log('[WA-Manager] Skipping group message:', remoteJid);
        return;
      }

      // Skip if message type is status or protocol (but allow if there's actual content)
      if (messageType === 'status' || messageType === 'protocol' || messageType === 'unknown') {
        const hasMedia = !!message.message?.imageMessage || 
                        !!message.message?.videoMessage || 
                        !!message.message?.audioMessage || 
                        !!message.message?.documentMessage ||
                        !!message.message?.stickerMessage;
        if (!messageContent && !hasMedia) {
          console.log('[WA-Manager] Skipping message with type:', messageType, 'no content');
          return;
        }
      }

      // Find contact (DO NOT auto-create - user must manually add contacts)
      // For fromMe messages, we need to find the contact that the user is chatting with
      // For !fromMe messages, the contact is the sender
      let contact = await prisma.contact.findFirst({
        where: { userId, phone },
      });

      // DO NOT auto-create contacts - only use existing ones
      // Contact name will come from database, not from WhatsApp pushName
      // If contact doesn't exist, chat will be created without contact (contactId = null)

      // Find or create chat
      let chat = await prisma.chat.findUnique({
        where: {
          userId_remoteJid: { userId, remoteJid },
        },
        include: {
          contact: true,
        },
      });

      if (!chat) {
        // DO NOT auto-create contact - chat can exist without contact
        // Only link to contact if it already exists in database
        chat = await prisma.chat.create({
          data: {
            userId,
            remoteJid,
            contactId: contact?.id || null, // only set when contact exists, null otherwise
            isGroup,
          },
          include: {
            contact: true,
          },
        });
      } else {
        // Update contact if chat exists but contactId is missing or wrong
        // Always use the correct contact for this phone number
        if (contact && chat.contactId !== contact.id) {
          await prisma.chat.update({
            where: { id: chat.id },
            data: { contactId: contact.id },
          });
          chat.contactId = contact.id;
          chat.contact = contact;
        } else if (!chat.contactId && contact) {
          // Chat has no contact but contact exists - link them
          await prisma.chat.update({
            where: { id: chat.id },
            data: { contactId: contact.id },
          });
          chat.contactId = contact.id;
          chat.contact = contact;
        } else if (chat.contactId && !contact) {
          // Chat has contactId but contact doesn't exist (maybe deleted) - clear it
          await prisma.chat.update({
            where: { id: chat.id },
            data: { contactId: null },
          });
          chat.contactId = null;
          chat.contact = null;
        }
      }

      // Download and save media if present
      let mediaUrl: string | undefined;
      const msg = message.message;
      const socket = await this.getSocket(userId);
      
      if (socket && msg) {
        try {
          // Download media for images, videos, audio, documents, stickers
          if (msg.imageMessage || msg.videoMessage || msg.audioMessage || 
              msg.documentMessage || msg.stickerMessage) {
            const mediaType = msg.imageMessage ? 'image' : 
                            msg.videoMessage ? 'video' : 
                            msg.audioMessage ? 'audio' : 
                            msg.stickerMessage ? 'sticker' : 'document';
            
            console.log('[WA-Manager] Downloading media:', { type: mediaType, fromMe: message.key.fromMe });
            
            try {
              // Download media with socket for authentication
              // This is critical for encrypted WhatsApp media URLs
              console.log('[WA-Manager] Starting media download:', { 
                type: mediaType, 
                fromMe: message.key.fromMe,
                hasSocket: !!socket
              });
              
              // Use 'buffer' as return type for downloadMediaMessage
              const buffer = await downloadMediaMessage(
                message,
                'buffer',
                {},
                {
                  logger,
                  reuploadRequest: socket.updateMediaMessage,
                }
              );

              // Convert buffer to base64 data URL for storage
              if (Buffer.isBuffer(buffer) && buffer.length > 0) {
                const mimeType = msg.imageMessage?.mimetype || 
                                msg.videoMessage?.mimetype || 
                                msg.audioMessage?.mimetype ||
                                msg.stickerMessage?.mimetype ||
                                msg.documentMessage?.mimetype || 
                                'image/jpeg';
                const base64 = buffer.toString('base64');
                mediaUrl = `data:${mimeType};base64,${base64}`;
                console.log('[WA-Manager] Media downloaded and converted to base64:', { 
                  type: mediaType, 
                  size: buffer.length,
                  mimeType,
                  base64Length: base64.length,
                  preview: base64.substring(0, 50) + '...'
                });
              } else {
                console.warn('[WA-Manager] Buffer is empty or not a buffer:', { 
                  isBuffer: Buffer.isBuffer(buffer),
                  length: buffer?.length,
                  type: typeof buffer
                });
                throw new Error('Empty or invalid buffer');
              }
            } catch (downloadError) {
              console.error('[WA-Manager] downloadMediaMessage failed:', {
                error: downloadError instanceof Error ? downloadError.message : String(downloadError),
                stack: downloadError instanceof Error ? downloadError.stack : undefined,
                type: mediaType,
                fromMe: message.key.fromMe
              });
              
              // Store URL for on-demand download via API
              // WhatsApp encrypted URLs need authentication, so we'll download on-demand
              const directUrl = msg.imageMessage?.url || 
                               msg.videoMessage?.url || 
                               msg.audioMessage?.url ||
                               msg.documentMessage?.url ||
                               msg.stickerMessage?.url;
              if (directUrl) {
                mediaUrl = directUrl;
                console.log('[WA-Manager] Storing encrypted URL for on-demand download:', directUrl.substring(0, 50));
              } else {
                console.error('[WA-Manager] No media URL available for:', mediaType);
              }
            }
          }
        } catch (error) {
          console.error('[WA-Manager] Failed to process media:', error);
          // Final fallback: try to get any available URL
          const directUrl = msg?.imageMessage?.url || 
                           msg?.videoMessage?.url || 
                           msg?.audioMessage?.url ||
                           msg?.documentMessage?.url ||
                           msg?.stickerMessage?.url;
          if (directUrl) {
            mediaUrl = directUrl;
          }
        }
      }

      // Check if message already exists (prevent duplicates)
      const existingMessage = await prisma.message.findFirst({
        where: {
          messageId: message.key.id || '',
          chatId: chat.id,
        },
      });

      if (existingMessage) {
        console.log('[WA-Manager] Message already exists, skipping:', {
          messageId: message.key.id,
          chatId: chat.id
        });
        return;
      }

      // Save message - use actual fromMe value from message
      const isFromMe = message.key.fromMe || false;
      const savedMessage = await prisma.message.create({
        data: {
          chatId: chat.id,
          userId,
          contactId: contact?.id,
          messageId: message.key.id || '',
          fromMe: isFromMe,
          type: messageType,
          content: messageContent,
          mediaUrl,
          mediaCaption: msg?.imageMessage?.caption || msg?.videoMessage?.caption || msg?.documentMessage?.caption || undefined,
          timestamp: new Date(Number(message.messageTimestamp) * 1000),
          status: 'SENT',
        },
      });

      console.log('[WA-Manager] Message saved:', {
        messageId: savedMessage.id,
        chatId: chat.id,
        type: messageType,
        fromMe: isFromMe,
        hasMedia: !!mediaUrl,
        content: messageContent?.substring(0, 50) || 'media'
      });


      // Update chat - only increment unreadCount for incoming messages
      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          lastMessageAt: new Date(),
          ...(message.key.fromMe ? {} : { unreadCount: { increment: 1 } }),
        },
      });

      // Update analytics - only for incoming messages
      if (!isFromMe) {
        await this.updateAnalytics(userId, { messagesReceived: 1 });
        
        // Process JSON-based bot automation if message has text content
        if (messageContent) {
          try {
            const { processBotMessage } = await import('../bot/json-bot-runner');
            await processBotMessage(
              userId,
              chat.id,
              messageContent,
              isFromMe,
              phone
            );
          } catch (error) {
            console.error('[WA-Manager] Bot processing error:', error);
            // Don't fail message processing if bot fails
          }
        }
      }
    } catch (error) {
      console.error('[WA-Manager] Failed to handle incoming message:', error);
      console.error('[WA-Manager] Error details:', {
        userId,
        remoteJid: message.key.remoteJid,
        messageId: message.key.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleMessageUpdate(
    userId: string,
    update: { key: proto.IMessageKey; update: Partial<proto.IWebMessageInfo> }
  ): Promise<void> {
    try {
      const { key, update: msgUpdate } = update;
      const messageId = key.id;

      if (!messageId) return;

      // Handle reactions
      if (msgUpdate.reactions && msgUpdate.reactions.length > 0) {
        const message = await prisma.message.findFirst({
          where: { messageId, userId },
        });

        if (message) {
          // Store reactions as JSON in content or create a separate field
          // For now, we'll log it - you can extend schema later if needed
          console.log('[WA-Manager] Reaction received:', {
            messageId,
            reactions: msgUpdate.reactions.map(r => ({
              key: r.key,
              text: r.text
            }))
          });
        }
      }

      const status = msgUpdate.status;
      let newStatus: 'DELIVERED' | 'READ' | undefined;

      if (status === 3) {
        newStatus = 'DELIVERED';
      } else if (status === 4) {
        newStatus = 'READ';
      }

      if (!newStatus) return;

      // Update blast message if exists
      const blastMessage = await prisma.blastMessage.findFirst({
        where: { messageId },
      });

      if (blastMessage) {
        await prisma.blastMessage.update({
          where: { id: blastMessage.id },
          data: {
            status: newStatus,
            ...(newStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
            ...(newStatus === 'READ' ? { readAt: new Date() } : {}),
          },
        });

        // Update blast counts
        if (newStatus === 'DELIVERED') {
          await prisma.blast.update({
            where: { id: blastMessage.blastId },
            data: { deliveredCount: { increment: 1 } },
          });
        } else if (newStatus === 'READ') {
          await prisma.blast.update({
            where: { id: blastMessage.blastId },
            data: { readCount: { increment: 1 } },
          });
        }
      }

      // Update regular message if exists
      await prisma.message.updateMany({
        where: { messageId, userId },
        data: { status: newStatus },
      });
    } catch (error) {
      console.error('Failed to handle message update:', error);
    }
  }

  private async processBotRules(
    userId: string,
    remoteJid: string,
    messageContent: string
  ): Promise<void> {
    try {
      const rules = await prisma.botRule.findMany({
        where: { userId, isActive: true },
        orderBy: { priority: 'desc' },
      });

      for (const rule of rules) {
        const keywords = JSON.parse(rule.keywords) as string[];
        let matched = false;

        for (const keyword of keywords) {
          switch (rule.matchType) {
            case 'exact':
              matched = messageContent.toLowerCase() === keyword.toLowerCase();
              break;
            case 'contains':
              matched = messageContent.toLowerCase().includes(keyword.toLowerCase());
              break;
            case 'startsWith':
              matched = messageContent.toLowerCase().startsWith(keyword.toLowerCase());
              break;
            case 'regex':
              try {
                const regex = new RegExp(keyword, 'i');
                matched = regex.test(messageContent);
              } catch {
                matched = false;
              }
              break;
          }

          if (matched) break;
        }

        if (matched) {
          // Send response
          const socket = await this.getSocket(userId);
          if (socket) {
            if (rule.mediaUrl && rule.mediaType) {
              // Send media response
              const mediaMessage: Record<string, unknown> = {};
              if (rule.mediaType === 'image') {
                mediaMessage.image = { url: rule.mediaUrl };
                if (rule.response) mediaMessage.caption = rule.response;
              }
              await socket.sendMessage(remoteJid, mediaMessage as any);
            } else {
              await socket.sendMessage(remoteJid, { text: rule.response });
            }

            // Update analytics
            await this.updateAnalytics(userId, { botInteractions: 1 });

            // Auto-tag contact if configured
            if (rule.autoTag) {
              const phone = remoteJid.split('@')[0];
              const contact = await prisma.contact.findFirst({
                where: { userId, phone },
              });

              if (contact) {
                const existingTags = contact.tags ? JSON.parse(contact.tags) : [];
                if (!existingTags.includes(rule.autoTag)) {
                  existingTags.push(rule.autoTag);
                  await prisma.contact.update({
                    where: { id: contact.id },
                    data: { tags: JSON.stringify(existingTags) },
                  });
                }
              }
            }
          }
          break; // Only trigger first matching rule
        }
      }
    } catch (error) {
      console.error('Failed to process bot rules:', error);
    }
  }

  private async updateAnalytics(
    userId: string,
    data: {
      blastCount?: number;
      blastSent?: number;
      blastDelivered?: number;
      blastRead?: number;
      blastFailed?: number;
      botInteractions?: number;
      messagesReceived?: number;
      messagesSent?: number;
      newContacts?: number;
    }
  ): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.analytics.upsert({
        where: {
          userId_date: { userId, date: today },
        },
        create: {
          userId,
          date: today,
          ...data,
        },
        update: {
          blastCount: data.blastCount ? { increment: data.blastCount } : undefined,
          blastSent: data.blastSent ? { increment: data.blastSent } : undefined,
          blastDelivered: data.blastDelivered ? { increment: data.blastDelivered } : undefined,
          blastRead: data.blastRead ? { increment: data.blastRead } : undefined,
          blastFailed: data.blastFailed ? { increment: data.blastFailed } : undefined,
          botInteractions: data.botInteractions ? { increment: data.botInteractions } : undefined,
          messagesReceived: data.messagesReceived ? { increment: data.messagesReceived } : undefined,
          messagesSent: data.messagesSent ? { increment: data.messagesSent } : undefined,
          newContacts: data.newContacts ? { increment: data.newContacts } : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to update analytics:', error);
    }
  }

  private extractMessageContent(message: proto.IWebMessageInfo): string {
    const msg = message.message;
    if (!msg) return '';

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.caption) return msg.documentMessage.caption;
    if (msg.buttonsResponseMessage?.selectedDisplayText)
      return msg.buttonsResponseMessage.selectedDisplayText;
    if (msg.listResponseMessage?.title) return msg.listResponseMessage.title;

    return '';
  }

  private getMessageType(message: proto.IWebMessageInfo): string {
    const msg = message.message;
    if (!msg) {
      // Check if it's a protocol message
      if (message.messageStubType) {
        return 'protocol';
      }
      return 'unknown';
    }

    if (msg.conversation || msg.extendedTextMessage) return 'text';
    if (msg.imageMessage) return 'image';
    if (msg.videoMessage) return 'video';
    if (msg.audioMessage) return 'audio';
    if (msg.documentMessage) return 'document';
    if (msg.stickerMessage) return 'sticker';
    if (msg.contactMessage) return 'contact';
    if (msg.locationMessage) return 'location';
    if (msg.buttonsResponseMessage) return 'button_response';
    if (msg.listResponseMessage) return 'list_response';
    
    // Check for protocol/stub messages
    if (message.messageStubType) {
      return 'protocol';
    }

    return 'unknown';
  }

  getStatus(userId: string): string {
    const connection = this.connections.get(userId);
    return connection?.status || 'disconnected';
  }

  getQRCode(userId: string): string | undefined {
    const connection = this.connections.get(userId);
    return connection?.qrCode;
  }

  // Import contacts from WhatsApp
  private async importContactsFromWhatsApp(userId: string, socket: WASocket): Promise<void> {
    try {
      debugLog('Starting contact import from WhatsApp', { userId });
      
      // Get contacts from WhatsApp store
      const store = (socket as any).store;
      if (!store) {
        debugLog('No store available for contact import', { userId });
        return;
      }

      // Try to get contacts from the socket's internal state
      const contacts = (store.contacts || {}) as Record<string, any>;
      let importCount = 0;

      for (const [jid, contact] of Object.entries(contacts)) {
        if (!jid.endsWith('@s.whatsapp.net')) continue;
        
        const phone = jid.split('@')[0];
        const name = (contact as { name?: string; notify?: string }).name || 
                    (contact as { name?: string; notify?: string }).notify || 
                    '';
        
        if (!phone || phone.length < 8) continue;

        try {
          await prisma.contact.upsert({
            where: {
              userId_phone: { userId, phone },
            },
            create: {
              userId,
              phone,
              name: name || undefined,
              autoSaved: true,
            },
            update: {
              // Only update name if contact doesn't have one
              name: name ? name : undefined,
            },
          });
          importCount++;
        } catch (err) {
          // Ignore individual contact errors
        }
      }

      debugLog('Contact import completed', { userId, importCount });

      // Update analytics
      if (importCount > 0) {
        await this.updateAnalytics(userId, { newContacts: importCount });
      }
    } catch (error) {
      debugLog('Contact import failed', { error: (error as Error).message });
    }
  }

  // Send message helper
  async sendMessage(
    userId: string,
    to: string,
    content: {
      text?: string;
      image?: { url: string };
      video?: { url: string };
      document?: { url: string; filename?: string };
      audio?: { url: string };
      caption?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const socket = await this.getSocket(userId);
      if (!socket) {
        return { success: false, error: 'WhatsApp not connected' };
      }

      const jid = to.includes('@') ? to : `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      
      let message: Record<string, unknown> = {};
      
      if (content.image) {
        message = { image: content.image, caption: content.caption || content.text };
      } else if (content.video) {
        message = { video: content.video, caption: content.caption || content.text };
      } else if (content.document) {
        message = { document: content.document, fileName: content.document.filename || 'document' };
      } else if (content.audio) {
        message = { audio: content.audio, ptt: true };
      } else if (content.text) {
        message = { text: content.text };
      } else {
        return { success: false, error: 'No content provided' };
      }

      const result = await socket.sendMessage(jid, message as any);
      return { success: true, messageId: result?.key?.id || undefined };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}

// Singleton instance - use global to persist across HMR in development
declare global {
  // eslint-disable-next-line no-var
  var __waManager: WhatsAppManager | undefined;
}

export function getWhatsAppManager(): WhatsAppManager {
  if (!global.__waManager) {
    console.log('[WA-Manager] Creating new WhatsAppManager instance');
    global.__waManager = new WhatsAppManager();
  }
  return global.__waManager;
}

export default WhatsAppManager;


