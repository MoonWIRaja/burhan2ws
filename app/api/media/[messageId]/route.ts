import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import { prisma } from '@/lib/prisma/client';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import pino from 'pino';

const logger = pino({ level: 'silent' });

export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  const startTime = Date.now();
  try {
    console.log('[Media] GET request received:', { 
      messageId: params.messageId,
      url: request.url 
    });
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

    // Get message from database
    const message = await prisma.message.findFirst({
      where: {
        id: params.messageId,
        userId: payload.userId,
      },
      include: {
        chat: true,
      },
    });

    if (!message || !message.mediaUrl) {
      return NextResponse.json(
        { success: false, error: 'Message or media not found' },
        { status: 404 }
      );
    }

    // If already base64, return directly
    if (message.mediaUrl.startsWith('data:')) {
      console.log('[Media] Serving base64 media directly');
      const [header, base64] = message.mediaUrl.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      
      const buffer = Buffer.from(base64, 'base64');
      console.log('[Media] Base64 media served:', { 
        size: buffer.length, 
        mimeType,
        duration: Date.now() - startTime + 'ms'
      });
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // Get WhatsApp socket and connection
    const waManager = getWhatsAppManager();
    const sock = await waManager.getSocket(payload.userId);

    if (!sock) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not connected' },
        { status: 400 }
      );
    }

    // Try to download using Baileys downloadMediaMessage
    // We need to get the original message from store or reconstruct it
    try {
      const connection = await waManager.getConnection(payload.userId);
      if (!connection || !connection.store) {
        throw new Error('No connection or store');
      }

      // Get message from store using remoteJid and messageId
      const remoteJid = message.chat.remoteJid;
      const whatsappMessageId = message.messageId;
      
      console.log('[Media] Attempting to download media:', { 
        remoteJid, 
        whatsappMessageId,
        mediaUrl: message.mediaUrl?.substring(0, 50),
        type: message.type
      });
      
      // Try to load message from store using socket's getMessage
      let storeMessage: any = null;
      
      // Method 1: Try store.loadMessage (most reliable)
      try {
        if (typeof connection.store.loadMessage === 'function') {
          storeMessage = await connection.store.loadMessage(remoteJid, whatsappMessageId);
          if (storeMessage) {
            console.log('[Media] Message loaded via store.loadMessage:', {
              hasKey: !!storeMessage.key,
              hasMessage: !!storeMessage.message,
              hasImage: !!storeMessage.message?.imageMessage,
              hasSticker: !!storeMessage.message?.stickerMessage,
              hasVideo: !!storeMessage.message?.videoMessage,
            });
          }
        }
      } catch (loadError) {
        console.error('[Media] store.loadMessage failed:', {
          error: loadError instanceof Error ? loadError.message : String(loadError)
        });
      }
      
      // Method 2: Use socket's getMessage function (if available)
      if (!storeMessage) {
        try {
          if (sock && typeof (sock as any).getMessage === 'function') {
            const msg = await (sock as any).getMessage({ remoteJid, id: whatsappMessageId });
            if (msg) {
              // Reconstruct full message object
              storeMessage = { 
                key: { remoteJid, id: whatsappMessageId, fromMe: message.fromMe }, 
                message: msg,
                messageTimestamp: Math.floor(new Date(message.timestamp).getTime() / 1000)
              };
              console.log('[Media] Message loaded via socket.getMessage');
            }
          }
        } catch (getMsgError) {
          console.error('[Media] socket.getMessage failed:', {
            error: getMsgError instanceof Error ? getMsgError.message : String(getMsgError)
          });
        }
      }
      
      // Method 3: Direct access to store.messages
      if (!storeMessage) {
        try {
          const storeMessages = (connection.store as any).messages;
          if (storeMessages) {
            // Try different store structures
            if (storeMessages[remoteJid]) {
              const chatMessages = storeMessages[remoteJid];
              if (typeof chatMessages.get === 'function') {
                storeMessage = chatMessages.get(whatsappMessageId);
              } else if (chatMessages[whatsappMessageId]) {
                storeMessage = chatMessages[whatsappMessageId];
              } else if (Array.isArray(chatMessages)) {
                storeMessage = chatMessages.find((m: any) => m.key?.id === whatsappMessageId);
              }
            }
            if (storeMessage) {
              console.log('[Media] Message loaded via direct store access');
            }
          }
        } catch (directError) {
          console.error('[Media] Direct store access failed:', directError);
        }
      }
      
      // Method 4: Reconstruct message object from database data and download
      // This is needed when store doesn't have the message
      if (!storeMessage && message.mediaUrl && message.mediaUrl.startsWith('https://mmg.whatsapp.net')) {
        console.log('[Media] Reconstructing message object from database');
        try {
          // Reconstruct a minimal message object that downloadMediaMessage can use
          // We need to create a proto.IWebMessageInfo-like object
          const reconstructedMessage: any = {
            key: {
              remoteJid: remoteJid,
              id: whatsappMessageId,
              fromMe: message.fromMe,
            },
            messageTimestamp: Math.floor(new Date(message.timestamp).getTime() / 1000),
            message: {},
          };
          
          // Reconstruct message content based on type
          if (message.type === 'image') {
            reconstructedMessage.message.imageMessage = {
              url: message.mediaUrl,
              mimetype: 'image/jpeg',
            };
          } else if (message.type === 'sticker') {
            reconstructedMessage.message.stickerMessage = {
              url: message.mediaUrl,
              mimetype: 'image/webp',
            };
          } else if (message.type === 'video') {
            reconstructedMessage.message.videoMessage = {
              url: message.mediaUrl,
              mimetype: 'video/mp4',
            };
          } else if (message.type === 'audio') {
            reconstructedMessage.message.audioMessage = {
              url: message.mediaUrl,
              mimetype: 'audio/ogg',
            };
          } else if (message.type === 'document') {
            reconstructedMessage.message.documentMessage = {
              url: message.mediaUrl,
              mimetype: 'application/octet-stream',
            };
          }
          
          // Try to download using reconstructed message
          const mediaType = message.type === 'sticker' ? 'sticker' :
                           message.type === 'image' ? 'image' :
                           message.type === 'video' ? 'video' :
                           message.type === 'audio' ? 'audio' : 'document';
          
          // This code should not be reached, but if it is, use correct signature
          console.log('[Media] Attempting download with reconstructed message (will likely fail without mediaKey)');
          const buffer = await downloadMediaMessage(
            reconstructedMessage,
            'buffer',
            {},
            {
              logger,
              reuploadRequest: sock.updateMediaMessage,
            }
          );
          
          if (Buffer.isBuffer(buffer) && buffer.length > 0) {
            console.log('[Media] Media downloaded successfully with reconstructed message:', { size: buffer.length });
            
            const mimeType = message.type === 'sticker' ? 'image/webp' :
                            message.type === 'image' ? 'image/jpeg' :
                            message.type === 'video' ? 'video/mp4' :
                            message.type === 'audio' ? 'audio/ogg' :
                            'application/octet-stream';
            
            // Update database with base64
            const base64 = buffer.toString('base64');
            await prisma.message.update({
              where: { id: message.id },
              data: {
                mediaUrl: `data:${mimeType};base64,${base64}`,
              },
            });
            
            return new NextResponse(buffer, {
              headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }
        } catch (reconstructError) {
          console.error('[Media] Reconstructed message download failed:', {
            error: reconstructError instanceof Error ? reconstructError.message : String(reconstructError),
            stack: reconstructError instanceof Error ? reconstructError.stack : undefined
          });
        }
      }
      
      // If we have the message, download media
      if (storeMessage && storeMessage.message) {
        console.log('[Media] Message found in store, downloading media...');
        
        // Determine media type from store message
        const msg = storeMessage.message;
        let mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'document';
        let mimeType = 'application/octet-stream';
        
        if (msg.imageMessage) {
          mediaType = 'image';
          mimeType = msg.imageMessage.mimetype || 'image/jpeg';
        } else if (msg.stickerMessage) {
          mediaType = 'sticker';
          mimeType = msg.stickerMessage.mimetype || 'image/webp';
        } else if (msg.videoMessage) {
          mediaType = 'video';
          mimeType = msg.videoMessage.mimetype || 'video/mp4';
        } else if (msg.audioMessage) {
          mediaType = 'audio';
          mimeType = msg.audioMessage.mimetype || 'audio/ogg';
        } else if (msg.documentMessage) {
          mediaType = 'document';
          mimeType = msg.documentMessage.mimetype || 'application/octet-stream';
        }

        try {
          console.log('[Media] Calling downloadMediaMessage with:', {
            hasKey: !!storeMessage.key,
            hasMessage: !!storeMessage.message,
            mediaType,
            mimeType
          });
          
          // Use 'buffer' as return type for downloadMediaMessage
          const buffer = await downloadMediaMessage(
            storeMessage,
            'buffer',
            {},
            {
              logger,
              reuploadRequest: sock.updateMediaMessage,
            }
          );

          if (Buffer.isBuffer(buffer) && buffer.length > 0) {
            console.log('[Media] Media downloaded successfully:', { 
              size: buffer.length, 
              type: mediaType,
              mimeType 
            });
            
            // Update database with base64 for future use
            const base64 = buffer.toString('base64');
            await prisma.message.update({
              where: { id: message.id },
              data: {
                mediaUrl: `data:${mimeType};base64,${base64}`,
              },
            });

            return new NextResponse(buffer, {
              headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          } else {
            console.error('[Media] Buffer is empty or invalid:', {
              isBuffer: Buffer.isBuffer(buffer),
              length: buffer?.length,
              type: typeof buffer
            });
          }
        } catch (downloadError) {
          console.error('[Media] downloadMediaMessage failed:', {
            error: downloadError instanceof Error ? downloadError.message : String(downloadError),
            stack: downloadError instanceof Error ? downloadError.stack : undefined,
            type: mediaType,
            hasMediaKey: !!(msg.imageMessage?.mediaKey || msg.stickerMessage?.mediaKey || msg.videoMessage?.mediaKey || msg.audioMessage?.mediaKey || msg.documentMessage?.mediaKey)
          });
        }
      } else {
        console.error('[Media] Message not found in store. Available methods exhausted.');
        console.error('[Media] Store status:', {
          hasStore: !!connection.store,
          hasLoadMessage: typeof connection.store?.loadMessage === 'function',
          remoteJid,
          whatsappMessageId
        });
      }
    } catch (storeError) {
      console.error('[Media] Failed to download from store:', storeError);
    }

    // Final fallback: try direct fetch (usually won't work for encrypted URLs, but worth trying)
    if (message.mediaUrl && message.mediaUrl.startsWith('https://')) {
      try {
        console.log('[Media] Attempting direct fetch as last resort');
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

          // Update database with base64 for future use
          const base64 = Buffer.from(buffer).toString('base64');
          await prisma.message.update({
            where: { id: message.id },
            data: {
              mediaUrl: `data:${contentType};base64,${base64}`,
            },
          });

          return new NextResponse(Buffer.from(buffer), {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        } else {
          console.error('[Media] Direct fetch failed with status:', response.status);
        }
      } catch (fetchError) {
        console.error('[Media] Direct fetch error:', fetchError);
      }
    }

    console.error('[Media] All download methods failed. Returning error response.');
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to download media. Message may not be in store or media URL is invalid.',
        details: {
          messageId: message.id,
          whatsappMessageId: message.messageId,
          mediaUrl: message.mediaUrl?.substring(0, 50),
          type: message.type
        }
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('[Media] Media proxy error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

          storeMessage = await connection.store.loadMessage(remoteJid, whatsappMessageId);
          if (storeMessage) {
            console.log('[Media] Message loaded via store.loadMessage:', {
              hasKey: !!storeMessage.key,
              hasMessage: !!storeMessage.message,
              hasImage: !!storeMessage.message?.imageMessage,
              hasSticker: !!storeMessage.message?.stickerMessage,
              hasVideo: !!storeMessage.message?.videoMessage,
            });
          }
        }
      } catch (loadError) {
        console.error('[Media] store.loadMessage failed:', {
          error: loadError instanceof Error ? loadError.message : String(loadError)
        });
      }
      
      // Method 2: Use socket's getMessage function (if available)
      if (!storeMessage) {
        try {
          if (sock && typeof (sock as any).getMessage === 'function') {
            const msg = await (sock as any).getMessage({ remoteJid, id: whatsappMessageId });
            if (msg) {
              // Reconstruct full message object
              storeMessage = { 
                key: { remoteJid, id: whatsappMessageId, fromMe: message.fromMe }, 
                message: msg,
                messageTimestamp: Math.floor(new Date(message.timestamp).getTime() / 1000)
              };
              console.log('[Media] Message loaded via socket.getMessage');
            }
          }
        } catch (getMsgError) {
          console.error('[Media] socket.getMessage failed:', {
            error: getMsgError instanceof Error ? getMsgError.message : String(getMsgError)
          });
        }
      }
      
      // Method 3: Direct access to store.messages
      if (!storeMessage) {
        try {
          const storeMessages = (connection.store as any).messages;
          if (storeMessages) {
            // Try different store structures
            if (storeMessages[remoteJid]) {
              const chatMessages = storeMessages[remoteJid];
              if (typeof chatMessages.get === 'function') {
                storeMessage = chatMessages.get(whatsappMessageId);
              } else if (chatMessages[whatsappMessageId]) {
                storeMessage = chatMessages[whatsappMessageId];
              } else if (Array.isArray(chatMessages)) {
                storeMessage = chatMessages.find((m: any) => m.key?.id === whatsappMessageId);
              }
            }
            if (storeMessage) {
              console.log('[Media] Message loaded via direct store access');
            }
          }
        } catch (directError) {
          console.error('[Media] Direct store access failed:', directError);
        }
      }
      
      // Method 4: Reconstruct message object from database data and download
      // This is needed when store doesn't have the message
      if (!storeMessage && message.mediaUrl && message.mediaUrl.startsWith('https://mmg.whatsapp.net')) {
        console.log('[Media] Reconstructing message object from database');
        try {
          // Reconstruct a minimal message object that downloadMediaMessage can use
          // We need to create a proto.IWebMessageInfo-like object
          const reconstructedMessage: any = {
            key: {
              remoteJid: remoteJid,
              id: whatsappMessageId,
              fromMe: message.fromMe,
            },
            messageTimestamp: Math.floor(new Date(message.timestamp).getTime() / 1000),
            message: {},
          };
          
          // Reconstruct message content based on type
          if (message.type === 'image') {
            reconstructedMessage.message.imageMessage = {
              url: message.mediaUrl,
              mimetype: 'image/jpeg',
            };
          } else if (message.type === 'sticker') {
            reconstructedMessage.message.stickerMessage = {
              url: message.mediaUrl,
              mimetype: 'image/webp',
            };
          } else if (message.type === 'video') {
            reconstructedMessage.message.videoMessage = {
              url: message.mediaUrl,
              mimetype: 'video/mp4',
            };
          } else if (message.type === 'audio') {
            reconstructedMessage.message.audioMessage = {
              url: message.mediaUrl,
              mimetype: 'audio/ogg',
            };
          } else if (message.type === 'document') {
            reconstructedMessage.message.documentMessage = {
              url: message.mediaUrl,
              mimetype: 'application/octet-stream',
            };
          }
          
          // Try to download using reconstructed message
          const mediaType = message.type === 'sticker' ? 'sticker' :
                           message.type === 'image' ? 'image' :
                           message.type === 'video' ? 'video' :
                           message.type === 'audio' ? 'audio' : 'document';
          
          // This code should not be reached, but if it is, use correct signature
          console.log('[Media] Attempting download with reconstructed message (will likely fail without mediaKey)');
          const buffer = await downloadMediaMessage(
            reconstructedMessage,
            'buffer',
            {},
            {
              logger,
              reuploadRequest: sock.updateMediaMessage,
            }
          );
          
          if (Buffer.isBuffer(buffer) && buffer.length > 0) {
            console.log('[Media] Media downloaded successfully with reconstructed message:', { size: buffer.length });
            
            const mimeType = message.type === 'sticker' ? 'image/webp' :
                            message.type === 'image' ? 'image/jpeg' :
                            message.type === 'video' ? 'video/mp4' :
                            message.type === 'audio' ? 'audio/ogg' :
                            'application/octet-stream';
            
            // Update database with base64
            const base64 = buffer.toString('base64');
            await prisma.message.update({
              where: { id: message.id },
              data: {
                mediaUrl: `data:${mimeType};base64,${base64}`,
              },
            });
            
            return new NextResponse(buffer, {
              headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          }
        } catch (reconstructError) {
          console.error('[Media] Reconstructed message download failed:', {
            error: reconstructError instanceof Error ? reconstructError.message : String(reconstructError),
            stack: reconstructError instanceof Error ? reconstructError.stack : undefined
          });
        }
      }
      
      // If we have the message, download media
      if (storeMessage && storeMessage.message) {
        console.log('[Media] Message found in store, downloading media...');
        
        // Determine media type from store message
        const msg = storeMessage.message;
        let mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'document';
        let mimeType = 'application/octet-stream';
        
        if (msg.imageMessage) {
          mediaType = 'image';
          mimeType = msg.imageMessage.mimetype || 'image/jpeg';
        } else if (msg.stickerMessage) {
          mediaType = 'sticker';
          mimeType = msg.stickerMessage.mimetype || 'image/webp';
        } else if (msg.videoMessage) {
          mediaType = 'video';
          mimeType = msg.videoMessage.mimetype || 'video/mp4';
        } else if (msg.audioMessage) {
          mediaType = 'audio';
          mimeType = msg.audioMessage.mimetype || 'audio/ogg';
        } else if (msg.documentMessage) {
          mediaType = 'document';
          mimeType = msg.documentMessage.mimetype || 'application/octet-stream';
        }

        try {
          console.log('[Media] Calling downloadMediaMessage with:', {
            hasKey: !!storeMessage.key,
            hasMessage: !!storeMessage.message,
            mediaType,
            mimeType
          });
          
          // Use 'buffer' as return type for downloadMediaMessage
          const buffer = await downloadMediaMessage(
            storeMessage,
            'buffer',
            {},
            {
              logger,
              reuploadRequest: sock.updateMediaMessage,
            }
          );

          if (Buffer.isBuffer(buffer) && buffer.length > 0) {
            console.log('[Media] Media downloaded successfully:', { 
              size: buffer.length, 
              type: mediaType,
              mimeType 
            });
            
            // Update database with base64 for future use
            const base64 = buffer.toString('base64');
            await prisma.message.update({
              where: { id: message.id },
              data: {
                mediaUrl: `data:${mimeType};base64,${base64}`,
              },
            });

            return new NextResponse(buffer, {
              headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
              },
            });
          } else {
            console.error('[Media] Buffer is empty or invalid:', {
              isBuffer: Buffer.isBuffer(buffer),
              length: buffer?.length,
              type: typeof buffer
            });
          }
        } catch (downloadError) {
          console.error('[Media] downloadMediaMessage failed:', {
            error: downloadError instanceof Error ? downloadError.message : String(downloadError),
            stack: downloadError instanceof Error ? downloadError.stack : undefined,
            type: mediaType,
            hasMediaKey: !!(msg.imageMessage?.mediaKey || msg.stickerMessage?.mediaKey || msg.videoMessage?.mediaKey || msg.audioMessage?.mediaKey || msg.documentMessage?.mediaKey)
          });
        }
      } else {
        console.error('[Media] Message not found in store. Available methods exhausted.');
        console.error('[Media] Store status:', {
          hasStore: !!connection.store,
          hasLoadMessage: typeof connection.store?.loadMessage === 'function',
          remoteJid,
          whatsappMessageId
        });
      }
    } catch (storeError) {
      console.error('[Media] Failed to download from store:', storeError);
    }

    // Final fallback: try direct fetch (usually won't work for encrypted URLs, but worth trying)
    if (message.mediaUrl && message.mediaUrl.startsWith('https://')) {
      try {
        console.log('[Media] Attempting direct fetch as last resort');
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

          // Update database with base64 for future use
          const base64 = Buffer.from(buffer).toString('base64');
          await prisma.message.update({
            where: { id: message.id },
            data: {
              mediaUrl: `data:${contentType};base64,${base64}`,
            },
          });

          return new NextResponse(Buffer.from(buffer), {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          });
        } else {
          console.error('[Media] Direct fetch failed with status:', response.status);
        }
      } catch (fetchError) {
        console.error('[Media] Direct fetch error:', fetchError);
      }
    }

    console.error('[Media] All download methods failed. Returning error response.');
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to download media. Message may not be in store or media URL is invalid.',
        details: {
          messageId: message.id,
          whatsappMessageId: message.messageId,
          mediaUrl: message.mediaUrl?.substring(0, 50),
          type: message.type
        }
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('[Media] Media proxy error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}