import { prisma } from '@/lib/prisma/client';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import type { WASocket } from '@whiskeysockets/baileys';

// Check if today is in the scheduled days
function isScheduledDay(scheduleDays: string | null, currentDay: number): boolean {
  if (!scheduleDays) return true; // No days specified = every day
  try {
    const days = JSON.parse(scheduleDays) as number[];
    if (days.length === 0) return true; // Empty array = every day
    return days.includes(currentDay);
  } catch {
    return true; // Invalid JSON = every day
  }
}

// Check if current time matches schedule time
function isScheduledTime(scheduleTime: string | null, currentTime: string): boolean {
  if (!scheduleTime) return false;
  // Compare HH:mm format
  return scheduleTime === currentTime;
}

// Helper function to get current time in UTC+8 (Malaysia time)
function getMalaysiaTime(): { date: Date; hours: number; minutes: number; day: number; timeString: string } {
  const now = new Date();
  // Convert to UTC+8 (Malaysia time)
  // Get UTC time in milliseconds
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  // Add 8 hours for UTC+8
  const malaysiaTimeMs = utcTime + (8 * 60 * 60 * 1000);
  const malaysiaTime = new Date(malaysiaTimeMs);
  
  const hours = malaysiaTime.getUTCHours();
  const minutes = malaysiaTime.getUTCMinutes();
  const day = malaysiaTime.getUTCDay();
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  return {
    date: malaysiaTime,
    hours,
    minutes,
    day,
    timeString,
  };
}

// Process a scheduled blast
async function processScheduledBlast(
  blast: {
    id: string;
    userId: string;
    message: string;
    mediaUrl: string | null;
    mediaType: string | null;
    minDelay: number;
    maxDelay: number;
  },
  socket: WASocket
) {
  console.log(`[Blast-Scheduler] Processing scheduled blast ${blast.id}`);

  // First, check if there are any messages at all
  const allMessages = await prisma.blastMessage.findMany({
    where: { blastId: blast.id },
    include: { contact: true },
  });
  
  if (allMessages.length === 0) {
    console.log(`[Blast-Scheduler] Blast ${blast.id} has no messages at all - cannot process`);
    return;
  }
  
  console.log(`[Blast-Scheduler] Blast ${blast.id} has ${allMessages.length} total messages`);

  // Reset all SENT/DELIVERED/READ messages to QUEUED for scheduled runs
  // For scheduled blasts, we need to reset messages to QUEUED so they can be sent again
  const resetCount = await prisma.blastMessage.updateMany({
    where: {
      blastId: blast.id,
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
    },
    data: {
      status: 'QUEUED',
      messageId: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
    },
  });
  
  if (resetCount.count > 0) {
    console.log(`[Blast-Scheduler] Reset ${resetCount.count} messages to QUEUED for blast ${blast.id}`);
  }

  // Get all queued messages (including newly reset ones)
  const messages = await prisma.blastMessage.findMany({
    where: {
      blastId: blast.id,
      status: 'QUEUED',
    },
    include: {
      contact: true,
    },
  });

  if (messages.length === 0) {
    console.log(`[Blast-Scheduler] No queued messages for blast ${blast.id} after reset - cannot process`);
    return;
  }
  
  console.log(`[Blast-Scheduler] Found ${messages.length} queued messages for blast ${blast.id}`);

  // Reset blast for new scheduled run
  await prisma.blast.update({
    where: { id: blast.id },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      lastScheduledRun: new Date(),
      sentCount: 0, // Reset counters for new scheduled run
      failedCount: 0,
      completedAt: null, // Clear completion time
    } as any,
  });

  // Import and call processBlastInBackground
  const { processBlastInBackground } = await import('@/app/api/blast/route');
  
  // Start processing in background (don't await - let it run async)
  console.log(`[Blast-Scheduler] Starting background processing for blast ${blast.id} with ${messages.length} messages`);
  console.log(`[Blast-Scheduler] Socket status: ${socket ? 'available' : 'null'}, User ID: ${blast.userId}`);
  
  // Verify socket is valid
  if (!socket) {
    console.error(`[Blast-Scheduler] No socket available for blast ${blast.id}`);
    await prisma.blast.update({
      where: { id: blast.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      } as any,
    });
    return;
  }
  
  // Start processing (fire and forget - don't await)
  // Use setImmediate to ensure it runs asynchronously
  setImmediate(() => {
    processBlastInBackground(
      blast.id,
      blast.userId,
      messages,
      blast.message,
      blast.mediaUrl || undefined,
      blast.mediaType || undefined,
      blast.minDelay,
      blast.maxDelay,
      socket
    ).then(() => {
      console.log(`[Blast-Scheduler] Background processing completed for blast ${blast.id}`);
    }).catch((error) => {
      console.error(`[Blast-Scheduler] Error processing scheduled blast ${blast.id}:`, error);
      // Update blast status to FAILED if processing fails
      prisma.blast.update({
        where: { id: blast.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        } as any,
      }).catch((updateError) => {
        console.error(`[Blast-Scheduler] Failed to update blast status:`, updateError);
      });
    });
  });
}

// Check and process scheduled blasts
export async function checkScheduledBlasts() {
  try {
    // Get Malaysia time (UTC+8)
    const malaysiaTime = getMalaysiaTime();
    const now = malaysiaTime.date;
    const currentDay = malaysiaTime.day; // 0 = Sunday, 1 = Monday, etc.
    const currentTime = malaysiaTime.timeString;

    console.log(`[Blast-Scheduler] Checking scheduled blasts at ${now.toISOString()} (UTC+8 Day: ${currentDay}, Time: ${currentTime} MYT)`);

    // Find all active scheduled blasts
    // Include SCHEDULED, RUNNING, and COMPLETED (to allow re-sending on schedule)
    // Use type assertion to work around Prisma type issues
    // Note: Database dates are stored in UTC, but we compare using Malaysia time context
    const scheduledBlasts = (await prisma.blast.findMany({
      where: {
        isScheduled: true,
        status: { in: ['SCHEDULED', 'RUNNING', 'COMPLETED'] },
        scheduleStartDate: {
          lte: new Date(), // Start date has passed (UTC comparison, but dates are stored correctly)
        },
        scheduleEndDate: {
          gte: new Date(), // End date hasn't passed (UTC comparison, but dates are stored correctly)
        },
      } as any,
    })) as unknown as Array<{
      id: string;
      userId: string;
      message: string;
      mediaUrl: string | null;
      mediaType: string | null;
      minDelay: number;
      maxDelay: number;
      status: string;
      isScheduled: boolean;
      scheduleStartDate: Date | null;
      scheduleEndDate: Date | null;
      scheduleTime: string | null;
      scheduleDays: string | null;
      lastScheduledRun: Date | null;
    }>;

    console.log(`[Blast-Scheduler] Found ${scheduledBlasts.length} scheduled blasts at ${currentTime} MYT`);
    
    // Log each blast for debugging
    for (const blast of scheduledBlasts) {
      console.log(`[Blast-Scheduler] Blast ${blast.id}: status=${blast.status}, time=${blast.scheduleTime}, days=${blast.scheduleDays}, start=${blast.scheduleStartDate}, end=${blast.scheduleEndDate}, lastRun=${blast.lastScheduledRun}`);
    }

    for (const blast of scheduledBlasts) {
      // Check if today is a scheduled day
      if (!isScheduledDay(blast.scheduleDays, currentDay)) {
        console.log(`[Blast-Scheduler] Blast ${blast.id} not scheduled for today (Day ${currentDay})`);
        continue;
      }

      // Check if we already sent today (avoid duplicate sends)
      const lastRun = blast.lastScheduledRun;
      // Use Malaysia time for date comparison
      const today = new Date(malaysiaTime.date);
      today.setUTCHours(0, 0, 0, 0);
      
      if (lastRun) {
        const lastRunDate = new Date(lastRun);
        lastRunDate.setHours(0, 0, 0, 0);
        
        // If already sent today, skip
        if (lastRunDate.getTime() === today.getTime()) {
          console.log(`[Blast-Scheduler] Blast ${blast.id} already sent today, skipping`);
          continue;
        }
      }

      // Check if current time matches schedule time OR if time has passed but not sent today
      if (!blast.scheduleTime) {
        console.log(`[Blast-Scheduler] Blast ${blast.id} has no schedule time, skipping`);
        continue;
      }

      const [scheduleHour, scheduleMinute] = blast.scheduleTime.split(':').map(Number);
      const scheduleTimeInMinutes = scheduleHour * 60 + scheduleMinute;
      // Use Malaysia time (UTC+8) for comparison
      const currentTimeInMinutes = malaysiaTime.hours * 60 + malaysiaTime.minutes;
      
      // Trigger if:
      // 1. Current time matches schedule time exactly (within same minute), OR
      // 2. Current time is within 1 minute after schedule time (to catch missed checks)
      // With 10-second check interval, we can catch the exact time reliably
      const timeDiff = currentTimeInMinutes - scheduleTimeInMinutes;
      const shouldTrigger = timeDiff >= 0 && timeDiff <= 1; // Within 1 minute window
      
      if (!shouldTrigger) {
        // Only log if we're close (within 5 minutes) to avoid spam
        if (timeDiff >= -5 && timeDiff < 0) {
          console.log(`[Blast-Scheduler] Blast ${blast.id} time check: current=${currentTime} schedule=${blast.scheduleTime} diff=${timeDiff}min (waiting...)`);
        }
        continue;
      }
      
      console.log(`[Blast-Scheduler] ✓ Blast ${blast.id} TIME MATCHED! current=${currentTime} schedule=${blast.scheduleTime} diff=${timeDiff}min`);

      // Get WhatsApp connection
      const waManager = getWhatsAppManager();
      let connection = await waManager.getConnection(blast.userId);
      
      if (!connection) {
        const allConnections = waManager.getAllConnections();
        for (const [userId, conn] of Array.from(allConnections.entries())) {
          if (conn.status === 'connected') {
            connection = conn;
            break;
          }
        }
      }

      if (!connection || connection.status !== 'connected') {
        console.log(`[Blast-Scheduler] No WhatsApp connection for blast ${blast.id}, skipping`);
        continue;
      }

      // Process the scheduled blast (don't await - let it run in background)
      console.log(`[Blast-Scheduler] Triggering blast ${blast.id} - will process in background`);
      processScheduledBlast(
        {
          id: blast.id,
          userId: blast.userId,
          message: blast.message,
          mediaUrl: blast.mediaUrl,
          mediaType: blast.mediaType,
          minDelay: blast.minDelay,
          maxDelay: blast.maxDelay,
        },
        connection.socket as WASocket
      ).catch((error) => {
        console.error(`[Blast-Scheduler] Error in processScheduledBlast for ${blast.id}:`, error);
      });
    }
  } catch (error) {
    console.error('[Blast-Scheduler] Error checking scheduled blasts:', error);
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

// Start scheduler (runs every minute)
export function startBlastScheduler() {
  // Only start if not already running
  if (schedulerInterval) {
    console.log('[Blast-Scheduler] Scheduler already running');
    return;
  }

  console.log('[Blast-Scheduler] Starting scheduler...');
  
  // Check immediately
  checkScheduledBlasts();
  
  // Then check every minute
  schedulerInterval = setInterval(() => {
    checkScheduledBlasts();
  }, 60000); // 60 seconds = 1 minute
}

// Stop scheduler (for cleanup if needed)
export function stopBlastScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Blast-Scheduler] Scheduler stopped');
  }
}

