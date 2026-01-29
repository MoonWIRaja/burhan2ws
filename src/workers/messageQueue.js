import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../config/database.js';
import sessionManager from '../whatsapp/sessionManager.js';

const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined
});

// Message Queue
export class MessageQueue {
  constructor() {
    this.queue = new Queue('messages', { connection: redis });
  }

  // Add send message job
  async addSendMessageJob(data) {
    return await this.queue.add('send-message', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }

  // Add send media job
  async addSendMediaJob(data) {
    return await this.queue.add('send-media', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
  }
}

// Message Worker
export class MessageWorker {
  constructor(io) {
    this.worker = new Worker(
      'messages',
      async (job) => {
        return await this.processJob(job, io);
      },
      { connection: redis, concurrency: 5 }
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed: ${job.name}`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed: ${err.message}`);
    });
  }

  async processJob(job, io) {
    const { sessionId, type } = job.data;

    switch (type) {
      case 'send-message':
        return await this.sendMessage(job, io);
      case 'send-media':
        return await this.sendMedia(job, io);
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  }

  async sendMessage(job, io) {
    const { sessionId, to, content } = job.data;

    const socket = sessionManager.getSocket(sessionId);
    if (!socket) {
      throw new Error('Session not connected');
    }

    try {
      // Send message via WhatsApp
      await socket.sendMessage(to, { text: content });

      // Save to database
      const message = await prisma.message.create({
        data: {
          sessionId,
          messageId: `sent_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          from: socket.user?.id,
          to,
          content,
          messageType: 'text',
          timestamp: new Date(),
          status: 'sent',
          direction: 'outbound'
        }
      });

      // Emit via WebSocket
      io.emit('message:sent', { sessionId, message });
      io.to(`session:${sessionId}`).emit('message:sent', { sessionId, message });

      return { success: true, messageId: message.id };
    } catch (error) {
      throw error;
    }
  }

  async sendMedia(job, io) {
    const { sessionId, to, mediaUrl, caption, type } = job.data;

    const socket = sessionManager.getSocket(sessionId);
    if (!socket) {
      throw new Error('Session not connected');
    }

    try {
      let mediaContent = { url: mediaUrl };

      // Add caption if provided
      if (caption) {
        mediaContent.caption = caption;
      }

      // Format based on type
      let messageFormat;
      switch (type) {
        case 'image':
          messageFormat = { image: mediaContent };
          break;
        case 'video':
          messageFormat = { video: mediaContent };
          break;
        case 'document':
          messageFormat = { document: mediaContent };
          break;
        case 'audio':
          messageFormat = { audio: mediaContent };
          break;
        default:
          messageFormat = { image: mediaContent };
      }

      // Send media via WhatsApp
      await socket.sendMessage(to, messageFormat);

      // Save to database
      const message = await prisma.message.create({
        data: {
          sessionId,
          messageId: `media_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          from: socket.user?.id,
          to,
          content: caption || '',
          messageType: type,
          timestamp: new Date(),
          status: 'sent',
          direction: 'outbound'
        }
      });

      // Emit via WebSocket
      io.emit('message:sent', { sessionId, message });
      io.to(`session:${sessionId}`).emit('message:sent', { sessionId, message });

      return { success: true, messageId: message.id };
    } catch (error) {
      throw error;
    }
  }
}

export default MessageWorker;
