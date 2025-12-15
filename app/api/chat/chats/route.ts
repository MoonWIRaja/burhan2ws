import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

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

    // Only get chats that are NOT channels, status, or broadcasts
    const chats = await prisma.chat.findMany({
      where: {
        userId: payload.userId,
        remoteJid: {
          not: {
            contains: '@news', // Newsletter channels
          },
        },
        AND: [
          {
            remoteJid: {
              not: {
                contains: 'status@', // Status updates
              },
            },
          },
          {
            remoteJid: {
              not: {
                contains: '@broadcast', // Broadcast lists
              },
            },
          },
        ],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        contact: {
          select: {
            id: true,
            phone: true,
            name: true,
          },
        },
      },
    });

    // User phone to filter out self-chat
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { phone: true },
    });

    const filteredChats = chats
      .filter((chat) => {
        const phone = chat.remoteJid.split('@')[0];
        return !user?.phone || phone !== user.phone;
      })
      .map((chat) => ({
        ...chat,
        contact: chat.contact
          ? {
              id: chat.contact.id,
              phone: chat.contact.phone,
              name: chat.contact.name || null,
            }
          : null,
      }));

    return NextResponse.json({
      success: true,
      data: filteredChats,
    });
  } catch (error) {
    console.error('Get chats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chats' },
      { status: 500 }
    );
  }
}
