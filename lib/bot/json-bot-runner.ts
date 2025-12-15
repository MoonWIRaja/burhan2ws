import { prisma } from '@/lib/prisma/client';
import { getWhatsAppManager } from '@/lib/whatsapp/manager';
import type { WASocket } from '@whiskeysockets/baileys';

interface BotRule {
  keywords: string[];
  matchType?: 'exact' | 'contains' | 'startsWith' | 'regex';
  response: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  priority?: number;
  autoTag?: string;
}

interface BotConfig {
  rules: BotRule[];
  greeting?: {
    enabled: boolean;
    message: string;
    mediaUrl?: string;
    mediaType?: string;
  };
  variables?: {
    [key: string]: string;
  };
}

/**
 * Process incoming message with JSON bot config
 */
export async function processBotMessage(
  userId: string,
  chatId: string,
  messageText: string,
  fromMe: boolean,
  contactPhone: string
): Promise<boolean> {
  try {
    // Skip if message is from user (not incoming)
    if (fromMe) return false;

    // Get active bot config for user with files (prefer main, fallback to first)
    const botConfig = await prisma.botConfig.findUnique({
      where: {
        userId,
      },
      include: {
        files: {
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!botConfig || !botConfig.isActive || !botConfig.isRunning || botConfig.files.length === 0) {
      return false;
    }

    const mainFile = botConfig.files.find((f) => f.isMain) || botConfig.files[0];

    // Process JavaScript/TypeScript bot
    if (mainFile.fileType === 'javascript' || mainFile.fileType === 'typescript') {
      const { processJavaScriptBot } = await import('./javascript-bot-runner');
      return await processJavaScriptBot(
        userId,
        chatId,
        messageText,
        fromMe,
        contactPhone,
        mainFile.content
      );
    }

    // Process JSON bot
    if (mainFile.fileType !== 'json') return false;

    // Parse JSON config
    let config: BotConfig;
    try {
      config = JSON.parse(mainFile.content);
    } catch (error) {
      console.error('[Bot-Runner] Invalid JSON config:', error);
      return false;
    }

    // Check greeting (first message from contact)
    if (config.greeting?.enabled) {
      const messageCount = await prisma.message.count({
        where: {
          chatId,
          fromMe: false,
        },
      });

      if (messageCount === 1) {
        // This is the first message from contact, send greeting
        await sendBotResponse(
          userId,
          chatId,
          config.greeting.message,
          config.greeting.mediaUrl,
          config.greeting.mediaType,
          config.variables
        );
        return true;
      }
    }

    // Process rules (sorted by priority, highest first)
    const sortedRules = (config.rules || []).sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sortedRules) {
      if (matchRule(messageText, rule)) {
        // Replace variables in response
        let response = rule.response;
        if (config.variables) {
          for (const [key, value] of Object.entries(config.variables)) {
            response = response.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
          }
        }

        // Send response
        await sendBotResponse(
          userId,
          chatId,
          response,
          rule.mediaUrl,
          rule.mediaType,
          config.variables
        );

        // Apply auto tag if specified
        if (rule.autoTag) {
          await applyAutoTag(userId, contactPhone, rule.autoTag);
        }

        return true; // Rule matched, stop processing
      }
    }

    return false; // No rule matched
  } catch (error) {
    console.error('[Bot-Runner] Error processing message:', error);
    return false;
  }
}

/**
 * Match message against rule
 */
function matchRule(messageText: string, rule: BotRule): boolean {
  const matchType = rule.matchType || 'contains';
  const keywords = rule.keywords || [];
  const lowerMessage = messageText.toLowerCase();

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();

    switch (matchType) {
      case 'exact':
        if (lowerMessage === lowerKeyword) return true;
        break;
      case 'startsWith':
        if (lowerMessage.startsWith(lowerKeyword)) return true;
        break;
      case 'regex':
        try {
          const regex = new RegExp(keyword, 'i');
          if (regex.test(messageText)) return true;
        } catch {
          // Invalid regex, skip
        }
        break;
      case 'contains':
      default:
        if (lowerMessage.includes(lowerKeyword)) return true;
        break;
    }
  }

  return false;
}

/**
 * Send bot response
 */
async function sendBotResponse(
  userId: string,
  chatId: string,
  message: string,
  mediaUrl?: string,
  mediaType?: string,
  variables?: { [key: string]: string }
): Promise<void> {
  try {
    const waManager = getWhatsAppManager();
    const connection = await waManager.getConnection(userId);

    if (!connection || connection.status !== 'connected') {
      console.error('[Bot-Runner] WhatsApp not connected');
      return;
    }

    const socket = connection.socket as WASocket;
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) return;

    // Replace variables
    let finalMessage = message;
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        finalMessage = finalMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }
    }

    // Send message
    let sentMessage: any;
    if (mediaUrl && mediaType) {
      // Send media message
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
      if (finalMessage) {
        mediaMessage.caption = finalMessage;
      }
      sentMessage = await socket.sendMessage(chat.remoteJid, mediaMessage);
    } else {
      // Send text message
      sentMessage = await socket.sendMessage(chat.remoteJid, {
        text: finalMessage,
      });
    }

    // Save message to database
    await prisma.message.create({
      data: {
        chatId,
        userId,
        messageId: sentMessage?.key?.id || `bot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        fromMe: true,
        type: mediaType || 'text',
        content: finalMessage,
        mediaUrl: mediaUrl || null,
        status: 'SENT',
        timestamp: new Date(),
      },
    });

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
      console.error('[Bot-Runner] Failed to update analytics:', error);
    }
  } catch (error) {
    console.error('[Bot-Runner] Error sending response:', error);
  }
}

/**
 * Apply auto tag to contact
 */
async function applyAutoTag(
  userId: string,
  phone: string,
  tag: string
): Promise<void> {
  try {
    const contact = await prisma.contact.findUnique({
      where: {
        userId_phone: { userId, phone },
      },
    });

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
  } catch (error) {
    console.error('[Bot-Runner] Error applying auto tag:', error);
  }
}

