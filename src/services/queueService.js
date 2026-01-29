import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection
const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
});

// Create queues
export const messageQueue = new Queue('messages', { connection });
export const fileQueue = new Queue('files', { connection });

/**
 * Add message job to queue
 */
export async function addMessageJob(data) {
  const job = await messageQueue.add('send-message', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  });

  // Save job to database
  const { getPrisma } = await import('../config/database.js');
  await getPrisma().job.create({
    data: {
      jobId: job.id,
      type: 'message',
      status: 'waiting',
      data
    }
  });

  return job;
}

/**
 * Add file processing job to queue
 */
export async function addFileJob(data) {
  const job = await fileQueue.add('process-file', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  });

  // Save job to database
  const { getPrisma } = await import('../config/database.js');
  await getPrisma().job.create({
    data: {
      jobId: job.id,
      type: 'file',
      status: 'waiting',
      data
    }
  });

  return job;
}

/**
 * Initialize workers
 */
export async function initWorkers() {
  // Message worker
  const messageWorker = new Worker(
    'messages',
    async (job) => {
      const { sessionId, to, content, messageType } = job.data;
      const { sendMessage } = await import('./whatsappService.js');

      try {
        const result = await sendMessage(sessionId, to, content, messageType);

        // Update job status
        const { getPrisma } = await import('../config/database.js');
        await getPrisma().job.update({
          where: { jobId: job.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            result
          }
        });

        return result;
      } catch (error) {
        // Update job status to failed
        const { getPrisma } = await import('../config/database.js');
        await getPrisma().job.update({
          where: { jobId: job.id },
          data: {
            status: 'failed',
            error: error.message
          }
        });

        throw error;
      }
    },
    { connection }
  );

  messageWorker.on('completed', (job) => {
    console.log(`✅ Message job ${job.id} completed`);
  });

  messageWorker.on('failed', (job, err) => {
    console.error(`❌ Message job ${job.id} failed:`, err.message);
  });

  // File worker
  const fileWorker = new Worker(
    'files',
    async (job) => {
      const { fileId, filePath } = job.data;
      const { getPrisma } = await import('../config/database.js');

      try {
        // Update file status to processing
        await getPrisma().file.update({
          where: { id: fileId },
          data: {
            uploadStatus: 'processing'
          }
        });

        // Process file (example: extract data from PDF or Excel)
        const { processFile } = await import('./fileService.js');
        const result = await processFile(filePath);

        // Update file status to completed
        await getPrisma().file.update({
          where: { id: fileId },
          data: {
            uploadStatus: 'completed',
            processedAt: new Date()
          }
        });

        // Update job status
        await getPrisma().job.update({
          where: { jobId: job.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            result
          }
        });

        return result;
      } catch (error) {
        // Update file status to failed
        await getPrisma().file.update({
          where: { id: fileId },
          data: {
            uploadStatus: 'failed'
          }
        });

        // Update job status to failed
        await getPrisma().job.update({
          where: { jobId: job.id },
          data: {
            status: 'failed',
            error: error.message
          }
        });

        throw error;
      }
    },
    { connection }
  );

  fileWorker.on('completed', (job) => {
    console.log(`✅ File job ${job.id} completed`);
  });

  fileWorker.on('failed', (job, err) => {
    console.error(`❌ File job ${job.id} failed:`, err.message);
  });

  console.log('✅ BullMQ workers initialized');
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  const [messageWaiting, messageActive, messageCompleted] = await Promise.all([
    messageQueue.getWaiting(),
    messageQueue.getActive(),
    messageQueue.getCompleted()
  ]);

  const [fileWaiting, fileActive, fileCompleted] = await Promise.all([
    fileQueue.getWaiting(),
    fileQueue.getActive(),
    fileQueue.getCompleted()
  ]);

  return {
    messages: {
      waiting: messageWaiting.length,
      active: messageActive.length,
      completed: messageCompleted.length
    },
    files: {
      waiting: fileWaiting.length,
      active: fileActive.length,
      completed: fileCompleted.length
    }
  };
}
