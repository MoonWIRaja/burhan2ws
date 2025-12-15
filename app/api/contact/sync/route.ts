import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';

export const dynamic = 'force-dynamic';

// Sync contacts from WhatsApp
export async function POST(request: NextRequest) {
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

    const waManager = getWhatsAppManager();
    
    // Try to find connection - check all connections if user was merged
    let connection = await waManager.getConnection(payload.userId);
    
    // If no connection, try to find by checking all connections
    if (!connection) {
      const allConnections = waManager.getAllConnections();
      for (const [userId, conn] of allConnections) {
        if (conn.status === 'connected') {
          connection = conn;
          console.log('[Sync] Using connection from user:', userId);
          break;
        }
      }
    }

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp not connected. Please scan QR code first.' },
        { status: 400 }
      );
    }

    if (connection.status !== 'connected') {
      return NextResponse.json(
        { success: false, error: `WhatsApp status: ${connection.status}. Please wait for connection.` },
        { status: 400 }
      );
    }

    const store = connection.store;
    const socket = connection.socket;
    
    let importCount = 0;
    let updateCount = 0;
    let totalFound = 0;
    const processedPhones = new Set<string>();

    // Helper to add contact
    const addContact = async (phone: string, name?: string) => {
      if (!phone || phone.length < 8 || processedPhones.has(phone)) return;
      processedPhones.add(phone);
      totalFound++;

      try {
        const existing = await prisma.contact.findUnique({
          where: {
            userId_phone: { userId: payload.userId, phone },
          },
        });

        if (existing) {
          // Only update name if contact is auto-saved OR has no name
          const canUpdateName = existing.autoSaved || !existing.name;
          if (name && name !== existing.name && canUpdateName) {
            await prisma.contact.update({
              where: { id: existing.id },
              data: { name },
            });
            updateCount++;
          }
        } else {
          await prisma.contact.create({
            data: {
              userId: payload.userId,
              phone,
              name: name || undefined,
              autoSaved: true,
            },
          });
          importCount++;
        }
      } catch (err) {
        // Ignore duplicate errors
      }
    };

    console.log('[Sync] Starting sync...');

    // Method 1: Get contacts from store.contacts (only personal chats)
    if (store?.contacts) {
      const contacts = store.contacts || {};
      console.log('[Sync] Store contacts:', Object.keys(contacts).length);
      
      for (const [jid, contact] of Object.entries(contacts)) {
        if (!jid.endsWith('@s.whatsapp.net')) continue;
        const phone = jid.split('@')[0];
        const data = contact as { name?: string; notify?: string; verifiedName?: string };
        await addContact(phone, data.name || data.notify || data.verifiedName);
      }
    }

    // Method 2: Get from chats (only personal chats)
    if (store?.chats) {
      try {
        const chats = store.chats.all?.() || [];
        console.log('[Sync] Store chats:', chats.length);
        
        for (const chat of chats) {
          if (!chat.id?.endsWith('@s.whatsapp.net')) continue; // skip groups/channels/status
          const phone = chat.id.split('@')[0];
          await addContact(phone, chat.name);
        }
      } catch (e) {
        console.log('[Sync] Chats error:', e);
      }
    }

    // Method 3: Request contacts directly from WhatsApp
    if (socket && totalFound === 0) {
      try {
        console.log('[Sync] Fetching contacts from WhatsApp...');
        
        // Try to get contact list using internal method
        const user = socket.user;
        if (user) {
          console.log('[Sync] Connected as:', user.id);
        }

        // Try fetching status of random numbers to trigger contact sync
        // This is a workaround since Baileys doesn't have direct contact fetch
        
        // Alternative: Look at message history
        if (store?.messages) {
          const messageJids = Object.keys(store.messages);
          console.log('[Sync] Message JIDs:', messageJids.length);
          
          for (const jid of messageJids) {
            if (!jid.endsWith('@s.whatsapp.net')) continue;
            const phone = jid.split('@')[0];
            await addContact(phone);
          }
        }
      } catch (err) {
        console.error('[Sync] Fetch error:', err);
      }
    }

    // Method 4: Check if there are any existing contacts in the store file
    if (totalFound === 0) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        // Find store.json files
        const sessionDir = path.join(process.cwd(), '.wa-sessions');
        if (fs.existsSync(sessionDir)) {
          const dirs = fs.readdirSync(sessionDir);
          for (const dir of dirs) {
            const storeFile = path.join(sessionDir, dir, 'store.json');
            if (fs.existsSync(storeFile)) {
              console.log('[Sync] Reading store file:', storeFile);
              try {
                const storeData = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
                
                // Extract contacts from stored chats
                if (storeData.chats) {
                  for (const chat of storeData.chats) {
                    if (chat.id?.endsWith('@s.whatsapp.net')) {
                      const phone = chat.id.split('@')[0];
                      await addContact(phone, chat.name);
                    }
                  }
                }
                
                // Extract from contacts
                if (storeData.contacts) {
                  for (const [jid, contact] of Object.entries(storeData.contacts)) {
                    if (jid.endsWith('@s.whatsapp.net')) {
                      const phone = jid.split('@')[0];
                      const data = contact as { name?: string; notify?: string };
                      await addContact(phone, data.name || data.notify);
                    }
                  }
                }
              } catch (parseErr) {
                console.log('[Sync] Store parse error:', parseErr);
              }
            }
          }
        }
      } catch (fsErr) {
        console.log('[Sync] FS error:', fsErr);
      }
    }

    console.log('[Sync] Complete:', { totalFound, importCount, updateCount });

    if (totalFound === 0) {
      return NextResponse.json({
        success: true,
        data: {
          imported: 0,
          updated: 0,
          total: 0,
        },
        message: 'No contacts found. WhatsApp may need more time to sync. Try sending a message first, then sync again.',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        imported: importCount,
        updated: updateCount,
        total: totalFound,
      },
    });
  } catch (error) {
    console.error('Sync contacts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync contacts' },
      { status: 500 }
    );
  }
}