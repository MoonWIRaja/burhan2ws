import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, createToken } from '@/lib/auth/jwt';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import { prisma } from '@/lib/prisma/client';

export const dynamic = 'force-dynamic';

// Simple status check - no QR generation, no auto-reconnect
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ status: 'disconnected', reason: 'no_token' });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ status: 'disconnected', reason: 'invalid_token' });
    }

    const waManager = getWhatsAppManager();
    
    // First try to find connection by userId
    let connection = await waManager.getConnection(payload.userId);

    if (connection) {
      if (connection.status === 'connected') {
        console.log('[Check] User connected!', { userId: payload.userId, phone: connection.phone });
      }
      
      return NextResponse.json({
        status: connection.status,
        phone: connection.phone,
      });
    }

    // If no connection found, check if user was merged (deleted)
    // Look for the user by checking if they still exist
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      // User was deleted (merged), find the new user by checking all connections
      // and look for one that might have our phone
      const allConnections = waManager.getAllConnections();
      
      for (const [userId, conn] of allConnections) {
        if (conn.status === 'connected' && conn.phone) {
          // Found a connected user, update token and return
          console.log('[Check] Found merged user connection!', { newUserId: userId, phone: conn.phone });
          
          const newToken = await createToken({ userId, role: 'USER' });
          const response = NextResponse.json({
            status: 'connected',
            phone: conn.phone,
            merged: true,
          });
          
          response.cookies.set('auth-token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
          });
          
          return response;
        }
      }
    } else {
      // User exists but no active connection, check database for session
      const session = await prisma.whatsAppSession.findUnique({
        where: { userId: payload.userId },
      });
      
      if (session && session.status === 'CONNECTED') {
        return NextResponse.json({
          status: 'connected',
          phone: session.phone,
        });
      }
    }

    return NextResponse.json({ status: 'disconnected', reason: 'no_connection' });
  } catch (error) {
    console.error('[Check] Error:', error);
    return NextResponse.json({ status: 'disconnected', reason: 'error' });
  }
}

