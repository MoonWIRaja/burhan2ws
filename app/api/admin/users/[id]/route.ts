import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { action } = await request.json();
    const userId = params.id;

    switch (action) {
      case 'enable':
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'ACTIVE' },
        });
        break;

      case 'disable':
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'DISABLED' },
        });
        // Also disconnect WhatsApp
        const waManager = getWhatsAppManager();
        await waManager.closeConnection(userId);
        break;

      case 'reset':
        // Reset WhatsApp session
        const manager = getWhatsAppManager();
        await manager.clearSession(userId);
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Log the action
    await prisma.log.create({
      data: {
        userId: payload.userId,
        action: `ADMIN_${action.toUpperCase()}_USER`,
        details: `User ID: ${userId}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${action} successful`,
    });
  } catch (error) {
    console.error('Admin user action error:', error);
    return NextResponse.json(
      { success: false, error: 'Action failed' },
      { status: 500 }
    );
  }
}



