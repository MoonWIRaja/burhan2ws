import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

export async function PATCH(request: NextRequest) {
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

    const { theme } = await request.json();

    if (!['dark', 'light', 'system'].includes(theme)) {
      return NextResponse.json(
        { success: false, error: 'Invalid theme' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: payload.userId },
      data: { theme },
    });

    return NextResponse.json({
      success: true,
      data: { theme },
    });
  } catch (error) {
    console.error('Update theme error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update theme' },
      { status: 500 }
    );
  }
}



