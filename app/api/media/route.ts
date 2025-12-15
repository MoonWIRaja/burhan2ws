import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import { prisma } from '@/lib/prisma/client';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';

const logger = pino({ level: 'silent' });

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

    const searchParams = request.nextUrl.searchParams;
    const mediaUrl = searchParams.get('url');
    const messageId = searchParams.get('messageId');

    // Get WhatsApp socket
    const waManager = getWhatsAppManager();
    const sock = await waManager.getSocket(payload.userId);

    if (!sock) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not connected' },
        { status: 400 }
      );
    }

    // If we have messageId, try to get original message and download via Baileys
    if (messageId) {
      try {
        const message = await prisma.message.findFirst({
          where: {
            id: messageId,
            userId: payload.userId,
          },
        });

        if (message && message.mediaUrl && message.mediaUrl.startsWith('https://')) {
          // Try to download using Baileys - but we need the original message object
          // For now, try direct fetch with WhatsApp headers
          try {
            const response = await fetch(message.mediaUrl, {
              headers: {
                'User-Agent': 'WhatsApp/2.0',
                'Origin': 'https://web.whatsapp.com',
                'Referer': 'https://web.whatsapp.com/',
              },
            });

            if (response.ok) {
              const buffer = await response.arrayBuffer();
              const contentType = response.headers.get('content-type') || 
                                 (message.type === 'sticker' ? 'image/webp' : 
                                  message.type === 'image' ? 'image/jpeg' : 
                                  'application/octet-stream');

              return new NextResponse(buffer, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=31536000, immutable',
                },
              });
            }
          } catch (fetchError) {
            console.error('[Media] Direct fetch failed:', fetchError);
          }
        }
      } catch (error) {
        console.error('[Media] Error getting message:', error);
      }
    }

    if (!mediaUrl) {
      return NextResponse.json(
        { success: false, error: 'URL parameter required' },
        { status: 400 }
      );
    }

    // Try to fetch with WhatsApp headers
    try {
      const response = await fetch(mediaUrl, {
        headers: {
          'User-Agent': 'WhatsApp/2.0',
          'Origin': 'https://web.whatsapp.com',
          'Referer': 'https://web.whatsapp.com/',
        },
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 
                           (mediaUrl.includes('.enc') ? 'image/jpeg' : 'application/octet-stream');

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } else {
        console.error('[Media] Failed to fetch:', response.status, response.statusText, mediaUrl.substring(0, 50));
        return NextResponse.json(
          { success: false, error: `Failed to fetch media: ${response.status}` },
          { status: response.status }
        );
      }
    } catch (error) {
      console.error('[Media] Failed to fetch media:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch media' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Media proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}




import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import { prisma } from '@/lib/prisma/client';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';

const logger = pino({ level: 'silent' });

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

    const searchParams = request.nextUrl.searchParams;
    const mediaUrl = searchParams.get('url');
    const messageId = searchParams.get('messageId');

    // Get WhatsApp socket
    const waManager = getWhatsAppManager();
    const sock = await waManager.getSocket(payload.userId);

    if (!sock) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not connected' },
        { status: 400 }
      );
    }

    // If we have messageId, try to get original message and download via Baileys
    if (messageId) {
      try {
        const message = await prisma.message.findFirst({
          where: {
            id: messageId,
            userId: payload.userId,
          },
        });

        if (message && message.mediaUrl && message.mediaUrl.startsWith('https://')) {
          // Try to download using Baileys - but we need the original message object
          // For now, try direct fetch with WhatsApp headers
          try {
            const response = await fetch(message.mediaUrl, {
              headers: {
                'User-Agent': 'WhatsApp/2.0',
                'Origin': 'https://web.whatsapp.com',
                'Referer': 'https://web.whatsapp.com/',
              },
            });

            if (response.ok) {
              const buffer = await response.arrayBuffer();
              const contentType = response.headers.get('content-type') || 
                                 (message.type === 'sticker' ? 'image/webp' : 
                                  message.type === 'image' ? 'image/jpeg' : 
                                  'application/octet-stream');

              return new NextResponse(buffer, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=31536000, immutable',
                },
              });
            }
          } catch (fetchError) {
            console.error('[Media] Direct fetch failed:', fetchError);
          }
        }
      } catch (error) {
        console.error('[Media] Error getting message:', error);
      }
    }

    if (!mediaUrl) {
      return NextResponse.json(
        { success: false, error: 'URL parameter required' },
        { status: 400 }
      );
    }

    // Try to fetch with WhatsApp headers
    try {
      const response = await fetch(mediaUrl, {
        headers: {
          'User-Agent': 'WhatsApp/2.0',
          'Origin': 'https://web.whatsapp.com',
          'Referer': 'https://web.whatsapp.com/',
        },
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 
                           (mediaUrl.includes('.enc') ? 'image/jpeg' : 'application/octet-stream');

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } else {
        console.error('[Media] Failed to fetch:', response.status, response.statusText, mediaUrl.substring(0, 50));
        return NextResponse.json(
          { success: false, error: `Failed to fetch media: ${response.status}` },
          { status: response.status }
        );
      }
    } catch (error) {
      console.error('[Media] Failed to fetch media:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch media' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Media proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}






