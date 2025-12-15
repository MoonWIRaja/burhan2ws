import { prisma } from '@/lib/prisma/client';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import type { WASocket } from '@whiskeysockets/baileys';
import makeWASocket, { DisconnectReason, useSingleFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Transform ES6 import statements to require or inject dependencies
 */
function transformImports(code: string): string {
  // Remove import statements and replace with injected dependencies
  // This is a simple transformation - for production, consider using a proper parser
  const importPatterns = [
    // import default, { x, y } from 'module'
    /import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,
    // import { x, y } from 'module'
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,
    // import x from 'module'
    /import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/g,
    // import * as x from 'module'
    /import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/g,
  ];

  let transformedCode = code;
  const injectedModules: string[] = [];

  // Transform imports
  transformedCode = transformedCode.replace(importPatterns[0], (match, defaultName, imports, module) => {
    // Combined default + named
    if (module === '@whiskeysockets/baileys' || module === '@adiwajshing/baileys') {
      injectedModules.push(`const ${defaultName} = bot.modules.baileys.default || bot.modules.baileys;`);
      injectedModules.push(`const { ${imports.trim()} } = bot.modules.baileys;`);
      return '';
    }
    if (module === '@hapi/boom') {
      injectedModules.push(`const ${defaultName} = bot.modules.boom;`);
      injectedModules.push(`const { ${imports.trim()} } = bot.modules.boom;`);
      return '';
    }
    if (module === 'node-fetch') {
      injectedModules.push(`const ${defaultName} = bot.modules.fetch;`);
      injectedModules.push(`const { ${imports.trim()} } = { fetch: bot.modules.fetch };`);
      return '';
    }
    if (module === 'fs') {
      injectedModules.push(`const ${defaultName} = bot.modules.fs;`);
      injectedModules.push(`const { ${imports.trim()} } = bot.modules.fs;`);
      return '';
    }
    if (module === 'path') {
      injectedModules.push(`const ${defaultName} = bot.modules.path;`);
      injectedModules.push(`const { ${imports.trim()} } = bot.modules.path;`);
      return '';
    }
    return '';
  });

  transformedCode = transformedCode.replace(importPatterns[1], (match, imports, module) => {
    if (module === '@whiskeysockets/baileys' || module === '@adiwajshing/baileys') {
      injectedModules.push(`const { ${imports.trim()} } = bot.modules.baileys;`);
      return '';
    }
    if (module === '@hapi/boom') {
      injectedModules.push(`const { ${imports.trim()} } = bot.modules.boom;`);
      return '';
    }
    if (module === 'node-fetch') {
      injectedModules.push(`const { ${imports.trim()} } = { fetch: bot.modules.fetch };`);
      return '';
    }
    if (module === 'fs') {
      injectedModules.push(`const { ${imports.trim()} } = bot.modules.fs;`);
      return '';
    }
    if (module === 'path') {
      injectedModules.push(`const { ${imports.trim()} } = bot.modules.path;`);
      return '';
    }
    return '';
  });

  transformedCode = transformedCode.replace(importPatterns[2], (match, name, module) => {
    if (module === '@whiskeysockets/baileys' || module === '@adiwajshing/baileys') {
      injectedModules.push(`const ${name} = bot.modules.baileys.default || bot.modules.baileys;`);
      return '';
    }
    if (module === '@hapi/boom') {
      injectedModules.push(`const ${name} = bot.modules.boom;`);
      return '';
    }
    if (module === 'node-fetch') {
      injectedModules.push(`const ${name} = bot.modules.fetch;`);
      return '';
    }
    if (module === 'fs') {
      injectedModules.push(`const ${name} = bot.modules.fs;`);
      return '';
    }
    if (module === 'path') {
      injectedModules.push(`const ${name} = bot.modules.path;`);
      return '';
    }
    return '';
  });

  transformedCode = transformedCode.replace(importPatterns[3], (match, name, module) => {
    if (module === '@whiskeysockets/baileys' || module === '@adiwajshing/baileys') {
      injectedModules.push(`const ${name} = bot.modules.baileys;`);
      return '';
    }
    if (module === '@hapi/boom') {
      injectedModules.push(`const ${name} = bot.modules.boom;`);
      return '';
    }
    if (module === 'node-fetch') {
      injectedModules.push(`const ${name} = bot.modules.fetch;`);
      return '';
    }
    if (module === 'fs') {
      injectedModules.push(`const ${name} = bot.modules.fs;`);
      return '';
    }
    if (module === 'path') {
      injectedModules.push(`const ${name} = bot.modules.path;`);
      return '';
    }
    return '';
  });

  // Prepend injected modules
  if (injectedModules.length > 0) {
    transformedCode = injectedModules.join('\n') + '\n' + transformedCode;
  }

  // Safety: strip any residual import lines that were not matched above
  transformedCode = transformedCode.replace(/^\s*import[^;]*;?\s*$/gm, '');

  return transformedCode;
}

/**
 * Process incoming message with JavaScript bot code
 */
export async function processJavaScriptBot(
  userId: string,
  chatId: string,
  messageText: string,
  fromMe: boolean,
  contactPhone: string,
  jsCode: string
): Promise<boolean> {
  try {
    // Get chat and contact info
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { contact: true },
    });

    if (!chat) return false;

    const contact = chat.contact;
    const waManager = getWhatsAppManager();
    const connection = await waManager.getConnection(userId);

    if (!connection || connection.status !== 'connected') {
      console.error('[JS-Bot-Runner] WhatsApp not connected');
      return false;
    }

    const socket = connection.socket as WASocket;

    // Transform imports in code
    let transformedCode = transformImports(jsCode);

    // Prepend safe bindings so user code uses injected modules/socket
    const prelude = `
      const __SAFE_MAKE_WA_SOCKET__ = () => (bot.sock || bot.socket || bot.modules?.baileys?.makeWASocket?.());
      const __SAFE_USE_SFA__ = bot.modules?.baileys?.useSingleFileAuthState || (() => ({
        state: (bot.sock || bot.socket)?.authState?.state || {},
        saveState: async () => {},
      }));
      const makeWASocket = __SAFE_MAKE_WA_SOCKET__;
      const useSingleFileAuthState = __SAFE_USE_SFA__;
      const fetch = bot.modules?.fetch;
      const fs = bot.modules?.fs;
      const path = bot.modules?.path;
    `;
    transformedCode = `${prelude}\n${transformedCode}`;

    // Provide safe wrappers so user code that calls makeWASocket/useSingleFileAuthState
    // will reuse the existing connected socket instead of creating a new one
    const safeUseSingleFileAuthState = () => ({
      state: (connection as any)?.authState?.state || {},
      saveState: async () => {},
    });

    const makeWASocketProxy = () => socket;

    // Create bot context with helper functions and modules
    const botContext = {
      // Message info
      message: messageText,
      fromMe,
      contactPhone,
      chatId,
      contactName: contact?.name || null,
      contactId: contact?.id || null,
      remoteJid: chat.remoteJid,

      // Socket (Baileys WASocket)
      sock: socket,
      socket: socket,

      // Modules for imports
      modules: {
        baileys: {
          default: makeWASocketProxy,
          makeWASocket: makeWASocketProxy,
          useSingleFileAuthState: safeUseSingleFileAuthState,
          DisconnectReason,
        },
        boom: {
          Boom,
        },
        fs: fs,
        path: path,
        fetch: typeof fetch !== 'undefined' ? fetch : undefined,
      },

      // Helper functions
      send: async (text: string, mediaUrl?: string, mediaType?: string) => {
        if (mediaUrl && mediaType) {
          const mediaMessage: any = {};
          if (mediaType === 'image') {
            mediaMessage.image = { url: mediaUrl };
          } else if (mediaType === 'video') {
            mediaMessage.video = { url: mediaUrl };
          } else if (mediaType === 'audio') {
            mediaMessage.audio = { url: mediaUrl };
          } else if (mediaType === 'document') {
            mediaMessage.document = { url: mediaUrl };
          }
          if (text) {
            mediaMessage.caption = text;
          }
          const sent = await socket.sendMessage(chat.remoteJid, mediaMessage);
          
          // Save to database
          await prisma.message.create({
            data: {
              chatId,
              userId,
              messageId: sent?.key?.id || `bot_${Date.now()}`,
              fromMe: true,
              type: mediaType || 'text',
              content: text,
              mediaUrl: mediaUrl || undefined,
              status: 'SENT',
              timestamp: new Date(),
            },
          });
        } else {
          const sent = await socket.sendMessage(chat.remoteJid, { text });
          
          // Save to database
          await prisma.message.create({
            data: {
              chatId,
              userId,
              messageId: sent?.key?.id || `bot_${Date.now()}`,
              fromMe: true,
              type: 'text',
              content: text,
              status: 'SENT',
              timestamp: new Date(),
            },
          });
        }
      },

      sendMessage: async (jid: string, message: any) => {
        const sent = await socket.sendMessage(jid, message);
        
        // Try to find chat by remoteJid
        const targetChat = await prisma.chat.findFirst({
          where: {
            userId,
            remoteJid: jid,
          },
        });

        if (targetChat) {
          // Save to database
          await prisma.message.create({
            data: {
              chatId: targetChat.id,
              userId,
              messageId: sent?.key?.id || `bot_${Date.now()}`,
              fromMe: true,
              type: 'text',
              content: typeof message === 'string' ? message : message.text || '',
              status: 'SENT',
              timestamp: new Date(),
            },
          });
        }

        return sent;
      },

      tagContact: async (tag: string) => {
        if (contact) {
          const existingTags = contact.tags ? JSON.parse(contact.tags) : [];
          if (!existingTags.includes(tag)) {
            existingTags.push(tag);
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                tags: JSON.stringify(existingTags),
              },
            });
          }
        }
      },

      getContactTags: async (): Promise<string[]> => {
        if (contact && contact.tags) {
          try {
            return JSON.parse(contact.tags);
          } catch {
            return [];
          }
        }
        return [];
      },

      // Utility functions
      log: (message: string, data?: any) => {
        console.log(`[JS-Bot] ${message}`, data || '');
      },
    };

    // Execute JavaScript code in a safe context
    // Support both event-driven code and simple message handlers
    const wrappedCode = `
      return (async function(bot) {
        // If code uses sock.ev.on, it's event-driven - just execute it
        // Otherwise, treat as message handler
        ${transformedCode}
      })(bot);
    `;

    // Create function with bot context
    const botFunction = new Function('bot', wrappedCode);
    
    // Execute with bot context
    try {
      await botFunction(botContext);
    } catch (error) {
      console.error('[JS-Bot-Runner] Error executing bot code:', error);
      // Log error but don't crash - bot should handle errors gracefully
      botContext.log('Error in bot code', error);
    }

    // Update analytics
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      await prisma.analytics.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          botInteractions: 1,
        },
        update: {
          botInteractions: { increment: 1 },
        },
      });
    } catch (error) {
      console.error('[JS-Bot-Runner] Failed to update analytics:', error);
    }

    return true;
  } catch (error) {
    console.error('[JS-Bot-Runner] Error executing JavaScript bot:', error);
    return false;
  }
}


