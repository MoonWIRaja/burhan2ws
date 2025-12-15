import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';

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

    // Get form data
    const formData = await request.formData();
    const chatId = formData.get('chatId') as string;
    const remoteJid = formData.get('remoteJid') as string;
    const message = formData.get('message') as string | null;
    const mediaFile = formData.get('media') as File | null;
    const mediaType = formData.get('mediaType') as string | null;

    // Get WhatsApp socket
    const waManager = getWhatsAppManager();
    const sock = await waManager.getSocket(payload.userId);

    if (!sock) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not connected' },
        { status: 400 }
      );
    }

    let messageId: string | undefined;
    let savedMessageType = 'text';
    let mediaUrl: string | undefined;
    let mediaCaption: string | undefined;

    // Send message with or without media
    if (mediaFile) {
      const arrayBuffer = await mediaFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Convert buffer to base64 data URL for storage
      const base64 = buffer.toString('base64');
      const mimeType = mediaFile.type || 
                      (mediaType === 'image' ? 'image/jpeg' : 
                       mediaType === 'video' ? 'video/mp4' : 
                       mediaType === 'audio' ? 'audio/webm' : 
                       'application/octet-stream');
      mediaUrl = `data:${mimeType};base64,${base64}`;
      mediaCaption = message || undefined;
      
      if (mediaType === 'image') {
        const result = await sock.sendMessage(remoteJid, {
          image: buffer,
          caption: message || undefined,
        });
        messageId = result?.key?.id;
        savedMessageType = 'image';
      } else if (mediaType === 'video') {
        const result = await sock.sendMessage(remoteJid, {
          video: buffer,
          caption: message || undefined,
        });
        messageId = result?.key?.id;
        savedMessageType = 'video';
      } else if (mediaType === 'audio') {
        const result = await sock.sendMessage(remoteJid, {
          audio: buffer,
          mimetype: 'audio/webm',
        });
        messageId = result?.key?.id;
        savedMessageType = 'audio';
      } else {
        // Document
        const result = await sock.sendMessage(remoteJid, {
          document: buffer,
          mimetype: mediaFile.type || 'application/octet-stream',
          fileName: mediaFile.name,
          caption: message || undefined,
        });
        messageId = result?.key?.id;
        savedMessageType = 'document';
      }
    } else if (message) {
      // Text only
      const result = await sock.sendMessage(remoteJid, { text: message });
      messageId = result?.key?.id;
    }

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Save to database with mediaUrl
    await prisma.message.create({
      data: {
        chatId,
        userId: payload.userId,
        messageId,
        fromMe: true,
        type: savedMessageType,
        content: message || undefined,
        mediaUrl,
        mediaCaption,
        status: 'SENT',
        timestamp: new Date(),
      },
    });

    console.log('[Chat-Send] Message saved:', {
      messageId,
      type: savedMessageType,
      hasMedia: !!mediaUrl,
      hasCaption: !!mediaCaption
    });

    // Update chat last message
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: { messageId },
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
