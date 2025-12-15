import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

// GET - Get bot status
export async function GET(_request: NextRequest) {
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

    let botConfig = await prisma.botConfig.findUnique({
      where: { userId: payload.userId },
    });

    if (!botConfig) {
      try {
        // Create bot config for user
        botConfig = await prisma.botConfig.create({
          data: {
            userId: payload.userId,
          },
        });
      } catch (createError: any) {
        // If create fails, try to find again (race condition)
        if (createError?.code === 'P2002') {
          botConfig = await prisma.botConfig.findUnique({
            where: { userId: payload.userId },
          });
        } else {
          throw createError;
        }
      }
    }

    if (!botConfig) {
      throw new Error('Failed to get or create bot config');
    }

    return NextResponse.json({
      success: true,
      data: {
        isActive: botConfig.isActive,
        isRunning: botConfig.isRunning,
        lastStarted: botConfig.lastStarted,
        lastStopped: botConfig.lastStopped,
        activeFileId: botConfig.activeFileId,
      },
    });
  } catch (error) {
    console.error('Get bot status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get bot status' },
      { status: 500 }
    );
  }
}



