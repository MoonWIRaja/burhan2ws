import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '../prisma/client';
import { getWhatsAppManager } from '../whatsapp/manager';
import type { BlastJobData, BotJobData } from './queue';
import type { WASocket } from '@whiskeysockets/baileys';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Helper function to get or create WhatsApp socket
async function getOrCreateSocket(userId: string): Promise<WASocket | null> {
  const waManager = getWhatsAppManager();
  
  // First try to get existing socket
  let sock = await waManager.getSocket(userId);
  if (sock) {
    console.log(`[Worker] Found existing socket for user ${userId}`);
    return sock;
  }
  
  // Try to find any connected socket (for merged users)
  const allConnections = waManager.getAllConnections();
  for (const [connUserId, conn] of Array.from(allConnections.entries())) {
    if (conn.status === 'connected' && conn.socket) {
      console.log(`[Worker] Using socket from connected user ${connUserId}`);
      return conn.socket;
    }
  }
  
  // No connection found - try to restore from database
  console.log(`[Worker] No active connection, trying to restore for user ${userId}...`);
  
  // Find user with session
  const session = await prisma.whatsAppSession.findFirst({
    where: {
      OR: [
        { userId },
        { status: 'CONNECTED' }
      ]
    },
    orderBy: { lastConnected: 'desc' }
  });
  
  if (session && session.status === 'CONNECTED') {
    console.log(`[Worker] Found session for user ${session.userId}, creating connection...`);
    try {
      await waManager.createConnection(session.userId);
      
      // Wait for connection to establish with retries
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const connection = await waManager.getConnection(session.userId);
        if (connection?.status === 'connected' && connection.socket) {
          console.log(`[Worker] Successfully restored connection for user ${session.userId} after ${i+1}s`);
          return connection.socket;
        }
        console.log(`[Worker] Waiting for connection... attempt ${i+1}/15`);
      }
      
      // Final check
      sock = await waManager.getSocket(session.userId);
      if (sock) {
        console.log(`[Worker] Successfully restored connection for user ${session.userId}`);
        return sock;
      }
    } catch (error) {
      console.error(`[Worker] Failed to restore connection:`, error);
    }
  } else {
    console.log(`[Worker] No connected session found in database for user ${userId}`);
  }
  
  return null;
}

// Blast Worker
const blastWorker = new Worker<BlastJobData>(
  'blast',
  async (job: Job<BlastJobData>) => {
    const { blastId, userId, messageData } = job.data;
    const { contactPhone, contactId, message, mediaUrl, mediaType, buttonData } = messageData;

    console.log(`[Blast Worker] Processing job ${job.id} for blast ${blastId}, contact: ${contactPhone}`);

    try {
      // Check if blast is still running
      const blast = await prisma.blast.findUnique({
        where: { id: blastId },
      });

      if (!blast || blast.status !== 'RUNNING') {
        console.log(`[Blast Worker] Blast ${blastId} is not running, skipping...`);
        return { success: false, reason: 'Blast not running' };
      }

      // Get WhatsApp socket (will restore connection if needed)
      const sock = await getOrCreateSocket(userId);

      if (!sock) {
        throw new Error('WhatsApp not connected - please reconnect via QR code');
      }

      // Format phone number to JID
      const jid = `${contactPhone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

      let messageId: string | undefined;

      // Send message based on type
      if (mediaUrl && mediaType) {
        // Send media message
        let mediaMessage: any;
        
        if (mediaType === 'image') {
          mediaMessage = {
            image: { url: mediaUrl },
            ...(message ? { caption: message } : {}),
          };
        } else if (mediaType === 'video') {
          mediaMessage = {
            video: { url: mediaUrl },
            ...(message ? { caption: message } : {}),
          };
        } else if (mediaType === 'audio') {
          mediaMessage = {
            audio: { url: mediaUrl },
            ptt: true, // Voice note
          };
        } else if (mediaType === 'document') {
          mediaMessage = {
            document: { url: mediaUrl },
            fileName: (message || 'document') as string,
            mimetype: 'application/octet-stream' as string,
          } as any;
        } else {
          // Fallback to text
          mediaMessage = { text: message };
        }

        const result = await sock.sendMessage(jid, mediaMessage as any);
        messageId = result?.key?.id || undefined;
      } else if (buttonData) {
        // Send button message (Note: buttons may not work on all WhatsApp versions)
        try {
          const buttons = JSON.parse(buttonData);
          const buttonMessage = {
            text: message,
            buttons: buttons.map((btn: { id: string; text: string }) => ({
              buttonId: btn.id,
              buttonText: { displayText: btn.text },
              type: 1,
            })),
            headerType: 1,
          };
          const result = await sock.sendMessage(jid, buttonMessage as any);
          messageId = result?.key?.id || undefined;
        } catch {
          // Fallback to text if buttons fail
          const result = await sock.sendMessage(jid, { text: message });
          messageId = result?.key?.id || undefined;
        }
      } else {
        // Send text message
        const result = await sock.sendMessage(jid, { text: message });
        messageId = result?.key?.id || undefined;
      }

      // Find and update blast message by blastId and contactId
      const blastMessage = await prisma.blastMessage.findFirst({
        where: {
          blastId,
          contactId,
        },
      });

      if (blastMessage) {
        await prisma.blastMessage.update({
          where: { id: blastMessage.id },
          data: {
            status: 'SENT',
            messageId,
            sentAt: new Date(),
          },
        });
      }

      // Update blast counts
      await prisma.blast.update({
        where: { id: blastId },
        data: {
          sentCount: { increment: 1 },
        },
      });

      // Check if blast is complete
      const remainingMessages = await prisma.blastMessage.count({
        where: {
          blastId,
          status: 'QUEUED',
        },
      });

      if (remainingMessages === 0) {
        await prisma.blast.update({
          where: { id: blastId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
        console.log(`[Blast Worker] Blast ${blastId} completed!`);
      }

      console.log(`[Blast Worker] Successfully sent message to ${contactPhone}`);
      return { success: true, messageId };
    } catch (error) {
      console.error(`[Blast Worker] Failed to send message:`, error);

      // Find and update blast message status to failed
      const blastMessage = await prisma.blastMessage.findFirst({
        where: {
          blastId,
          contactId,
        },
      });

      if (blastMessage) {
        // Truncate error message to avoid database column overflow
        let errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errorMsg.length > 500) {
          errorMsg = errorMsg.substring(0, 500) + '... (truncated)';
        }
        
        await prisma.blastMessage.update({
          where: { id: blastMessage.id },
          data: {
            status: 'FAILED',
            error: errorMsg,
          },
        });
      }

      // Update blast failed count
      await prisma.blast.update({
        where: { id: blastId },
        data: {
          failedCount: { increment: 1 },
        },
      });

      throw error;
    }
  },
  {
    connection,
    concurrency: 1, // Process one at a time to avoid rate limiting
    limiter: {
      max: 10,
      duration: 60000, // Max 10 messages per minute
    },
  }
);

// Bot Worker
const botWorker = new Worker<BotJobData>(
  'bot',
  async (job: Job<BotJobData>) => {
    const { userId, remoteJid, message } = job.data;

    console.log(`[Bot Worker] Processing job ${job.id}`);

    try {
      // Get WhatsApp socket (will restore connection if needed)
      const sock = await getOrCreateSocket(userId);

      if (!sock) {
        throw new Error('WhatsApp not connected - please reconnect via QR code');
      }

      // Send the message
      await sock.sendMessage(remoteJid, { text: message });

      console.log(`[Bot Worker] Successfully sent bot response to ${remoteJid}`);
      return { success: true };
    } catch (error) {
      console.error(`[Bot Worker] Failed to send bot response:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

// Event handlers
blastWorker.on('completed', (job) => {
  console.log(`[Blast Worker] Job ${job.id} completed`);
});

blastWorker.on('failed', (job, err) => {
  console.error(`[Blast Worker] Job ${job?.id} failed:`, err.message);
});

botWorker.on('completed', (job) => {
  console.log(`[Bot Worker] Job ${job.id} completed`);
});

botWorker.on('failed', (job, err) => {
  console.error(`[Bot Worker] Job ${job?.id} failed:`, err.message);
});

console.log('Workers started successfully');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await blastWorker.close();
  await botWorker.close();
  process.exit(0);
});
