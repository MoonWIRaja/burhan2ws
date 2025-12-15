import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import { prisma } from '@/lib/prisma/client';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ status: 'disconnected' });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ status: 'disconnected' });
    }

    const waManager = getWhatsAppManager();
    
    // First check in-memory connection
    let connection = await waManager.getConnection(payload.userId);

    // If no active connection, check if user has a stored session to restore
    if (!connection) {
      const session = await prisma.whatsAppSession.findUnique({
        where: { userId: payload.userId },
      });

      // If user has stored session data, try to reconnect automatically
      if (session && session.sessionData && session.status !== 'LOGGED_OUT') {
        console.log('[Status] Auto-reconnecting user with stored session...', {
          userId: payload.userId,
          phone: session.phone,
        });
        
        // Attempt to create connection (will restore from stored session)
        try {
          connection = await waManager.createConnection(payload.userId);
        } catch (err) {
          console.error('[Status] Auto-reconnect failed:', err);
        }
      }
    }

    if (connection) {
      let qrSvg: string | undefined;
      if (connection.status === 'qr_pending' && connection.qrCode) {
        qrSvg = await QRCode.toString(connection.qrCode, {
          type: 'svg',
          margin: 2,
          width: 256,
        });
      }

      return NextResponse.json({
        status: connection.status,
        qr: qrSvg,
        phone: connection.phone,
      });
    }

    // If still no connection, check database for session status
    const session = await prisma.whatsAppSession.findUnique({
      where: { userId: payload.userId },
    });

    if (session) {
      const statusMap: Record<string, string> = {
        'CONNECTED': 'connected',
        'DISCONNECTED': 'disconnected',
        'CONNECTING': 'connecting',
        'QR_PENDING': 'qr_pending',
        'LOGGED_OUT': 'disconnected',
      };

      let qrSvg: string | undefined;
      if (session.status === 'QR_PENDING' && session.qrCode) {
        qrSvg = await QRCode.toString(session.qrCode, {
          type: 'svg',
          margin: 2,
          width: 256,
        });
      }

      return NextResponse.json({
        status: statusMap[session.status] || 'disconnected',
        qr: qrSvg,
        phone: session.phone,
      });
    }

    return NextResponse.json({ status: 'disconnected' });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ status: 'disconnected' });
  }
}

