import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Blast Queue
export const blastQueue = new Queue('blast', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600 * 24, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 3600 * 24 * 7, // 7 days
    },
  },
});

// Bot Queue (for delayed responses)
export const botQueue = new Queue('bot', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: {
      age: 3600 * 24,
    },
  },
});

// Types for blast jobs
export interface BlastJobData {
  blastId: string;
  userId: string;
  messageData: {
    contactPhone: string;
    contactId: string;
    message: string;
    mediaUrl?: string;
    mediaType?: string;
    buttonData?: string;
  };
  delay: number;
}

export interface BotJobData {
  userId: string;
  chatId: string;
  remoteJid: string;
  flowId?: string;
  nodeId?: string;
  message: string;
  delay: number;
}

// Add blast message to queue
export async function addBlastJob(data: BlastJobData): Promise<Job<BlastJobData>> {
  return blastQueue.add('send-message', data, {
    delay: data.delay,
    jobId: `blast-${data.blastId}-${data.messageData.contactId}`,
  });
}

// Add bot response to queue
export async function addBotJob(data: BotJobData): Promise<Job<BotJobData>> {
  return botQueue.add('bot-response', data, {
    delay: data.delay,
  });
}

// Get blast queue stats
export async function getBlastQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    blastQueue.getWaitingCount(),
    blastQueue.getActiveCount(),
    blastQueue.getCompletedCount(),
    blastQueue.getFailedCount(),
    blastQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// Pause/Resume blast queue
export async function pauseBlastQueue(): Promise<void> {
  await blastQueue.pause();
}

export async function resumeBlastQueue(): Promise<void> {
  await blastQueue.resume();
}

// Clean old jobs
export async function cleanBlastQueue(): Promise<void> {
  await blastQueue.clean(3600 * 24 * 1000, 1000, 'completed');
  await blastQueue.clean(3600 * 24 * 7 * 1000, 1000, 'failed');
}



