import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        whatsappSession: {
          select: {
            status: true,
            phone: true,
          },
        },
      },
    });

    if (!user || user.status === 'DISABLED') {
      return NextResponse.json({
        authenticated: false,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        theme: user.theme,
      },
      whatsappStatus: user.whatsappSession?.status?.toLowerCase() || 'disconnected',
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({
      authenticated: false,
    });
  }
}



