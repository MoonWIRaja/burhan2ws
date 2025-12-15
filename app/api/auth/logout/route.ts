import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        // Disconnect WhatsApp session
        const waManager = getWhatsAppManager();
        await waManager.closeConnection(payload.userId);
      }
    }

    // Clear the auth cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: true });
  }
}



