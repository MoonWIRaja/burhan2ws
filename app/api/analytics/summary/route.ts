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

    // Get aggregated stats
    const [blastStats, contactCount, analyticsSum] = await Promise.all([
      prisma.blast.aggregate({
        where: { userId: payload.userId },
        _count: { id: true },
        _sum: {
          sentCount: true,
          deliveredCount: true,
          readCount: true,
          failedCount: true,
        },
      }),
      prisma.contact.count({
        where: { userId: payload.userId },
      }),
      prisma.analytics.aggregate({
        where: { userId: payload.userId },
        _sum: {
          botInteractions: true,
          messagesReceived: true,
          messagesSent: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalBlasts: blastStats._count.id,
        sentCount: blastStats._sum.sentCount || 0,
        deliveredCount: blastStats._sum.deliveredCount || 0,
        readCount: blastStats._sum.readCount || 0,
        failedCount: blastStats._sum.failedCount || 0,
        botInteractions: analyticsSum._sum.botInteractions || 0,
        totalContacts: contactCount,
        messagesReceived: analyticsSum._sum.messagesReceived || 0,
        messagesSent: analyticsSum._sum.messagesSent || 0,
      },
    });
  } catch (error) {
    console.error('Get analytics summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}



