import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';
import type { WASocket } from '@whiskeysockets/baileys';

// Replace variables in message text with contact data
function replaceVariables(text: string, contact: { phone: string; name: string | null }): string {
  let replaced = text;
  
  // Replace {name} with contact name or phone if name is not available
  const contactName = contact.name || contact.phone || 'Friend';
  replaced = replaced.replace(/\{name\}/g, contactName);
  
  // Replace {phone} with contact phone
  replaced = replaced.replace(/\{phone\}/g, contact.phone);
  
  return replaced;
}

// Process blast messages in background using the existing WhatsApp connection
export async function processBlastInBackground(
  blastId: string,
  userId: string,
  messages: Array<{ id: string; contactId: string; contact: { phone: string; name: string | null } }>,
  messageText: string,
  mediaUrl: string | undefined,
  mediaType: string | undefined,
  minDelay: number,
  maxDelay: number,
  sock: WASocket
) {
  console.log(`[Blast] Starting background processing for blast ${blastId} with ${messages.length} messages`);
  
  if (!sock) {
    console.error(`[Blast] No socket provided for blast ${blastId}`);
    await prisma.blast.update({
      where: { id: blastId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });
    return;
  }
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    try {
      // Check if blast is still running
      const blast = await prisma.blast.findUnique({
        where: { id: blastId },
        select: { status: true },
      });
      
      if (!blast || blast.status !== 'RUNNING') {
        console.log(`[Blast] Blast ${blastId} is no longer running (${blast?.status}), stopping...`);
        break;
      }
      
      // Replace variables in message text with contact data
      const personalizedMessage = replaceVariables(messageText, msg.contact);
      
      // Format phone number to JID
      const jid = `${msg.contact.phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      
      let messageId: string | undefined;
      
      // Send message
      if (mediaUrl && mediaType) {
        // Handle base64 or URL media
        const isBase64 = mediaUrl.startsWith('data:');
        
        if (mediaType === 'image') {
          const result = await sock.sendMessage(jid, {
            image: isBase64 ? Buffer.from(mediaUrl.split(',')[1], 'base64') : { url: mediaUrl },
            caption: personalizedMessage,
          });
          messageId = result?.key?.id;
        } else if (mediaType === 'video') {
          const result = await sock.sendMessage(jid, {
            video: isBase64 ? Buffer.from(mediaUrl.split(',')[1], 'base64') : { url: mediaUrl },
            caption: personalizedMessage,
          });
          messageId = result?.key?.id;
        } else if (mediaType === 'audio') {
          const result = await sock.sendMessage(jid, {
            audio: isBase64 ? Buffer.from(mediaUrl.split(',')[1], 'base64') : { url: mediaUrl },
            mimetype: 'audio/mpeg',
          });
          messageId = result?.key?.id;
        } else if (mediaType === 'document') {
          const result = await sock.sendMessage(jid, {
            document: isBase64 ? Buffer.from(mediaUrl.split(',')[1], 'base64') : { url: mediaUrl },
            mimetype: 'application/pdf',
            caption: personalizedMessage,
          });
          messageId = result?.key?.id;
        }
      } else {
        // Send text message with personalized content
        const result = await sock.sendMessage(jid, { text: personalizedMessage });
        messageId = result?.key?.id;
      }
      
      // Update message status to SENT
      await prisma.blastMessage.update({
        where: { id: msg.id },
        data: {
          status: 'SENT',
          messageId,
          sentAt: new Date(),
        },
      });
      
      // Update blast sent count
      await prisma.blast.update({
        where: { id: blastId },
        data: {
          sentCount: { increment: 1 },
        },
      });
      
      console.log(`[Blast] Sent message ${i + 1}/${messages.length} to ${msg.contact.phone}`);
      
    } catch (error) {
      console.error(`[Blast] Failed to send to ${msg.contact.phone}:`, error);
      
      // Truncate error message
      let errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.length > 500) {
        errorMsg = errorMsg.substring(0, 500) + '... (truncated)';
      }
      
      // Update message status to FAILED
      await prisma.blastMessage.update({
        where: { id: msg.id },
        data: {
          status: 'FAILED',
          error: errorMsg,
        },
      });
      
      // Update blast failed count
      await prisma.blast.update({
        where: { id: blastId },
        data: {
          failedCount: { increment: 1 },
        },
      });
    }
    
    // Wait before next message (except for last message)
    if (i < messages.length - 1) {
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // Mark blast as completed
  await prisma.blast.update({
    where: { id: blastId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
  
  console.log(`[Blast] Blast ${blastId} completed!`);
}

const blastSchema = z.object({
  name: z.string().min(1),
  message: z.string().min(1),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional().nullable(),
  buttonData: z.string().optional().nullable(),
  speed: z.enum(['NORMAL', 'SLOW', 'RANDOM']).default('NORMAL'),
  contactIds: z.array(z.string()).min(1),
  scheduledAt: z.string().datetime().optional().nullable(),
  // Scheduling fields
  isScheduled: z.boolean().optional().default(false),
  scheduleStartDate: z.string().datetime().optional().nullable(), // ISO datetime string
  scheduleEndDate: z.string().datetime().optional().nullable(), // ISO datetime string
  scheduleTime: z.string().optional().nullable(), // HH:mm format
  scheduleDays: z.string().optional().nullable(), // JSON string of day numbers
});

// Get all blasts
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { userId: payload.userId };
    if (status) {
      where.status = status;
    }

    const [blasts, total] = await Promise.all([
      prisma.blast.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.blast.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: blasts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Get blasts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get blasts' },
      { status: 500 }
    );
  }
}

// Create and start blast
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check WhatsApp connection - handle merged users
    const { getWhatsAppManager } = await import('@/lib/whatsapp/manager');
    const waManager = getWhatsAppManager();
    let connection = await waManager.getConnection(payload.userId);
    
    // If no connection found, try to find any connected session
    if (!connection) {
      const allConnections = waManager.getAllConnections();
      for (const [userId, conn] of allConnections) {
        if (conn.status === 'connected') {
          connection = conn;
          console.log('[Blast] Using connection from merged user:', userId);
          break;
        }
      }
    }
    
    if (!connection || connection.status !== 'connected') {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not connected. Please scan QR code first.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Normalize undefined/null values
    if (body.mediaUrl === undefined || body.mediaUrl === '') body.mediaUrl = null;
    if (body.mediaType === undefined || body.mediaType === '') body.mediaType = null;
    if (body.buttonData === undefined || body.buttonData === '') body.buttonData = null;
    if (body.scheduledAt === undefined || body.scheduledAt === '') body.scheduledAt = null;
    
    // Convert scheduleDays from array to JSON string if needed
    if (body.scheduleDays !== undefined && body.scheduleDays !== null) {
      if (Array.isArray(body.scheduleDays)) {
        body.scheduleDays = body.scheduleDays.length > 0 ? JSON.stringify(body.scheduleDays) : null;
      } else if (typeof body.scheduleDays === 'string' && body.scheduleDays === '') {
        body.scheduleDays = null;
      }
    } else {
      body.scheduleDays = null;
    }
    
    // Convert date strings to ISO datetime strings if needed (for validation)
    if (body.scheduleStartDate && body.scheduleStartDate !== '' && !body.scheduleStartDate.includes('T')) {
      // Date is in YYYY-MM-DD format, convert to ISO datetime
      body.scheduleStartDate = new Date(body.scheduleStartDate + 'T00:00:00Z').toISOString();
    } else if (!body.scheduleStartDate || body.scheduleStartDate === '') {
      body.scheduleStartDate = null;
    }
    if (body.scheduleEndDate && body.scheduleEndDate !== '' && !body.scheduleEndDate.includes('T')) {
      // Date is in YYYY-MM-DD format, convert to ISO datetime
      body.scheduleEndDate = new Date(body.scheduleEndDate + 'T23:59:59Z').toISOString();
    } else if (!body.scheduleEndDate || body.scheduleEndDate === '') {
      body.scheduleEndDate = null;
    }
    if (!body.scheduleTime || body.scheduleTime === '') {
      body.scheduleTime = null;
    }
    
    const data = blastSchema.parse(body);

    // Get contacts
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: data.contactIds },
        userId: payload.userId,
        isBlocked: false,
      },
    });

    if (contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid contacts found' },
        { status: 400 }
      );
    }

    // Calculate delays based on speed
    let minDelay = 3000;
    let maxDelay = 5000;
    if (data.speed === 'SLOW') {
      minDelay = 5000;
      maxDelay = 10000;
    } else if (data.speed === 'RANDOM') {
      minDelay = 3000;
      maxDelay = 15000;
    }

    // Determine status based on scheduling
    const isScheduled = data.isScheduled || false;
    const shouldStartNow = !isScheduled && !data.scheduledAt;

    // Create blast
    const blast = await prisma.blast.create({
      data: {
        userId: payload.userId,
        name: data.name,
        message: data.message,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        buttonData: data.buttonData,
        speed: data.speed,
        minDelay,
        maxDelay,
        totalRecipients: contacts.length,
        status: shouldStartNow ? 'RUNNING' : 'SCHEDULED',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        startedAt: shouldStartNow ? new Date() : null,
        // Scheduling fields
        isScheduled,
        scheduleStartDate: data.scheduleStartDate ? new Date(data.scheduleStartDate) : null,
        scheduleEndDate: data.scheduleEndDate ? new Date(data.scheduleEndDate) : null,
        scheduleTime: data.scheduleTime || null,
        scheduleDays: data.scheduleDays || null,
      },
    });

    // Create blast messages
    const blastMessages = await prisma.blastMessage.createMany({
      data: contacts.map((contact) => ({
        blastId: blast.id,
        contactId: contact.id,
        status: 'QUEUED',
      })),
    });

    // Process messages directly if not scheduled (no worker needed)
    if (shouldStartNow) {
      const createdMessages = await prisma.blastMessage.findMany({
        where: { blastId: blast.id },
        include: { contact: true },
      });

      // Start blast processing in background (non-blocking)
      // Don't await - let it run in background
      processBlastInBackground(
        blast.id,
        payload.userId,
        createdMessages,
        data.message,
        data.mediaUrl,
        data.mediaType,
        minDelay,
        maxDelay,
        connection.socket as WASocket
      ).catch((error) => {
        console.error(`[Blast] Background processing error for blast ${blast.id}:`, error);
      });
    } else {
      console.log(`[Blast] Blast ${blast.id} scheduled. Will be processed by scheduler.`);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...blast,
        messageCount: blastMessages.count,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors },
        { status: 400 }
      );
    }
    console.error('Create blast error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create blast' },
      { status: 500 }
    );
  }
}


