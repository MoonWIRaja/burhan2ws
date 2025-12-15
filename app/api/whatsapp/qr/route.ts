import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, createToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    let token = cookieStore.get('auth-token')?.value;
    let userId: string;
    let existingPhone: string | null = null;

    // Check existing token
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        // Get user info including phone
        const existingUser = await prisma.user.findUnique({
          where: { id: payload.userId },
          include: { whatsappSession: true },
        });
        
        if (existingUser) {
          userId = existingUser.id;
          existingPhone = existingUser.phone;
          
          // If user has phone and stored session, try auto-reconnect
          if (existingUser.phone && existingUser.whatsappSession) {
            console.log('[QR] User has stored session, attempting reconnect...', {
              userId,
              phone: existingUser.phone,
              sessionStatus: existingUser.whatsappSession.status,
            });
          }
        } else {
          // Token valid but user not found, create new
          const user = await prisma.user.create({
            data: { status: 'PENDING' },
          });
          userId = user.id;
          token = await createToken({ userId: user.id, role: 'USER' });
        }
      } else {
        // Invalid token, create new user
        const user = await prisma.user.create({
          data: { status: 'PENDING' },
        });
        userId = user.id;
        token = await createToken({ userId: user.id, role: 'USER' });
      }
    } else {
      // No token, create new user
      const user = await prisma.user.create({
        data: { status: 'PENDING' },
      });
      userId = user.id;
      token = await createToken({ userId: user.id, role: 'USER' });
    }

    // Initialize WhatsApp connection using Baileys
    const waManager = getWhatsAppManager();
    
    // Create connection
    const connection = await waManager.createConnection(userId);

    // Helper to create response with proper token
    const createResponse = async (
      status: string, 
      qrSvg?: string, 
      phone?: string,
      finalUserId?: string
    ) => {
      // If user was merged, update token
      const tokenUserId = finalUserId || userId;
      if (finalUserId && finalUserId !== userId) {
        token = await createToken({ userId: finalUserId, role: 'USER' });
      }
      
      const response = NextResponse.json({
        success: true,
        status,
        qr: qrSvg,
        phone,
        userId: tokenUserId,
        message: status === 'connected' 
          ? 'WhatsApp connected successfully' 
          : status === 'qr_pending'
          ? 'Scan this QR code with WhatsApp'
          : 'Connecting to WhatsApp...',
      });

      response.cookies.set('auth-token', token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      return response;
    };

    // If already connected
    if (connection.status === 'connected') {
      return createResponse('connected', undefined, connection.phone, userId);
    }

    // If QR code available
    if (connection.qrCode) {
      const qrSvg = await QRCode.toString(connection.qrCode, {
        type: 'svg',
        margin: 2,
        width: 256,
      });
      return createResponse('qr_pending', qrSvg);
    }

    // Wait for QR code or connection event (max 10 seconds)
    return new Promise<NextResponse>((resolve) => {
      const timeout = setTimeout(async () => {
        waManager.off('qr', handleQR);
        waManager.off('connected', handleConnected);
        resolve(await createResponse('connecting'));
      }, 10000);

      const handleQR = async ({ userId: qrUserId, qr }: { userId: string; qr: string }) => {
        if (qrUserId !== userId) return;
        
        clearTimeout(timeout);
        waManager.off('qr', handleQR);
        waManager.off('connected', handleConnected);

        const qrSvg = await QRCode.toString(qr, {
          type: 'svg',
          margin: 2,
          width: 256,
        });

        resolve(await createResponse('qr_pending', qrSvg));
      };

      const handleConnected = async ({ 
        userId: connUserId, 
        phone, 
        originalUserId 
      }: { 
        userId: string; 
        phone?: string; 
        originalUserId?: string;
      }) => {
        // Match either original or merged userId
        if (connUserId !== userId && originalUserId !== userId) return;
        
        clearTimeout(timeout);
        waManager.off('qr', handleQR);
        waManager.off('connected', handleConnected);

        // Use the final userId (after merge)
        resolve(await createResponse('connected', undefined, phone, connUserId));
      };

      waManager.on('qr', handleQR);
      waManager.on('connected', handleConnected);
    });
  } catch (error) {
    console.error('QR generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate QR code: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

