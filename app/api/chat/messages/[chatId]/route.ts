import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
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

    // Handle both Promise and direct params (Next.js 14+ compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const chatId = resolvedParams.chatId;

    console.log('[Chat-Messages] Fetching messages:', { chatId, userId: payload.userId });

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userId: payload.userId,
      },
    });

    if (!chat) {
      console.log('[Chat-Messages] Chat not found:', { chatId, userId: payload.userId });
      return NextResponse.json(
        { success: false, error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Mark as read
    await prisma.chat.update({
      where: { id: chat.id },
      data: { unreadCount: 0 },
    });

    // Get messages - FILTER OUT STATUS MESSAGES
    const messages = await prisma.message.findMany({
      where: { 
        chatId: chat.id,
        type: {
          not: 'status' // Exclude status messages
        }
      },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    console.log('[Chat-Messages] Returning messages:', { chatId: chat.id, count: messages.length });

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}