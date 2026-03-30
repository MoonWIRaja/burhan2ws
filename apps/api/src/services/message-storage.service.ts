import { db, conversations, messages, contacts, normalizePhoneNumber, isValidPhoneNumber } from "@whatsapp-blast/database";
import { eq, and, gt, lt } from "drizzle-orm";
import { Server } from "socket.io";
import { insertReturningOne, updateReturningOne } from "../utils/db-compat.js";

// Global Socket.io instance - will be set from index.ts
let io: Server | null = null;

export function setSocketIO(instance: Server) {
  io = instance;
}

function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized in message-storage.service");
  }
  return io;
}

/**
 * Get display identifier from JID
 * Returns normalized phone number (WhatsApp only - LinkedIn is rejected)
 */
function getIdentifierFromJid(fromJid: string): { phoneNumber: string } {
  // WhatsApp number - normalize it using shared utility
  // Note: LinkedIn JIDs are rejected before this function is called
  const phoneNumber = normalizePhoneNumber(fromJid.replace("@s.whatsapp.net", ""));
  return { phoneNumber };
}

/**
 * Save WhatsApp message to database
 * Creates conversation if doesn't exist, adds message
 * ONLY supports WhatsApp phone numbers - LinkedIn and other services are skipped
 * @param fromMe - TRUE if user sent this message, FALSE if received from someone else
 * @param senderName - Contact name from pushName (e.g., "Melaka Eye Specialist")
 * @param waMessageId - WhatsApp message ID for deduplication
 * @param isFromAi - TRUE if this is an AI/bot generated reply
 * @param inputTokens - AI input tokens used (for cost tracking)
 * @param outputTokens - AI output tokens used (for cost tracking)
 * @param aiCost - Calculated AI cost in RM
 */
export async function saveMessage(
  userId: string,
  fromJid: string,
  messageBody: string,
  fromMe: boolean,
  timestamp: number = Date.now(),
  senderName?: string,
  waMessageId?: string,
  isFromAi: boolean = false,
  inputTokens: number = 0,
  outputTokens: number = 0,
  aiCost: string = "0"
) {
  try {
    // CRITICAL: ONLY accept WhatsApp phone numbers (@s.whatsapp.net)
    // BLOCK: LinkedIn (@lid), groups (@g.us), newsletters, etc.
    const jidDomain = fromJid.split('@')[1];

    if (jidDomain !== "s.whatsapp.net") {
      console.log(`[MessageStorage] 🚫 Blocked non-phone JID: ${fromJid} (type: ${jidDomain}) - Only real phone numbers allowed`);
      return null;
    }

    // Get identifier (phone number)
    const { phoneNumber } = getIdentifierFromJid(fromJid);

    // Validate format using shared utility
    if (!isValidPhoneNumber(phoneNumber)) {
      console.log(`[MessageStorage] 🚫 Invalid format: ${phoneNumber}`);
      return null;
    }

    console.log(`[MessageStorage] 💾 Saving ${fromMe ? "OUTGOING (from user)" : "INCOMING (from other)"} message from ${phoneNumber} (WhatsApp) to ${userId}`);

    // phoneNumber is already normalized from getIdentifierFromJid
    const normalizedPhone = phoneNumber;

    // Find or create conversation (check all conversations and match by normalized phone)
    const allConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
    });

    let conversation = allConversations.find(c => {
      const existingNormalized = normalizePhoneNumber(c.phoneNumber);
      return existingNormalized === normalizedPhone;
    });

    if (!conversation) {
      // Check if contact exists (also using normalized phone)
      const allContacts = await db.query.contacts.findMany({
        where: eq(contacts.userId, userId),
      });

      const contact = allContacts.find(c => {
        const contactNormalized = normalizePhoneNumber(c.phoneNumber);
        return contactNormalized === normalizedPhone;
      });

      // Create new conversation with contact info if found
      const newConv = await insertReturningOne(conversations, {
        userId,
        phoneNumber: normalizedPhone,
        contactId: contact?.id || null,
        contactName: contact?.name || null,  // Use saved contact name
        status: "active",
        lastMessageAt: new Date(timestamp),
        lastMessagePreview: messageBody.substring(0, 100),
        unreadCount: fromMe ? 0 : 1,  // Only increment unread for incoming
        isAiEnabled: true, // Default AI ON for new conversations
      });
      conversation = newConv;
      console.log(`[MessageStorage] ✅ Created new conversation: ${newConv.id}, contact: ${contact?.name || phoneNumber}`);
    } else {
      // Update existing conversation
      const updated = await updateReturningOne(
        conversations,
        eq(conversations.id, conversation.id),
        {
          lastMessageAt: new Date(timestamp),
          lastMessagePreview: messageBody.substring(0, 100),
          unreadCount: fromMe ? 0 : (conversation.unreadCount || 0) + 1,  // Only increment for incoming
          updatedAt: new Date(),
        }
      );
      conversation = updated;
      console.log(`[MessageStorage] ✅ Updated conversation: ${conversation.id}`);
    }

    // Check for duplicate message using WhatsApp message ID first (most reliable)
    // This prevents double-saving when a message sent from web triggers WhatsApp event
    let duplicateCheck = null;

    if (waMessageId) {
      duplicateCheck = await db.query.messages.findFirst({
        where: and(
          eq(messages.conversationId, conversation.id),
          eq(messages.waMessageId, waMessageId)
        ),
      });

      if (duplicateCheck) {
        console.log(`[MessageStorage] ⚠️ Duplicate message detected by waMessageId: ${waMessageId}, skipping save. Existing: ${duplicateCheck.id}`);
        return {
          conversation,
          message: duplicateCheck,
        };
      }
    }

    // Fallback duplicate check: same content, same conversation, within 10 seconds, same fromMe
    if (!duplicateCheck) {
      duplicateCheck = await db.query.messages.findFirst({
        where: and(
          eq(messages.conversationId, conversation.id),
          eq(messages.content, messageBody),
          eq(messages.fromMe, fromMe),  // Must also match the fromMe flag
          gt(messages.timestamp, new Date(timestamp - 10000)), // Within 10 seconds before
          lt(messages.timestamp, new Date(timestamp + 10000))  // Within 10 seconds after
        ),
      });

      if (duplicateCheck) {
        console.log(`[MessageStorage] ⚠️ Duplicate message detected by content/time (fromMe=${fromMe}), skipping save. Existing: ${duplicateCheck.id}`);
        return {
          conversation,
          message: duplicateCheck,
        };
      }
    }

    // Save the message with CORRECT fromMe flag, isFromAi flag and waMessageId
    const newMessage = await insertReturningOne(messages, {
      conversationId: conversation.id,
      content: messageBody,
      fromMe: fromMe,  // Use actual fromMe flag!
      messageType: "text",
      status: fromMe ? "sent" : "received",
      timestamp: new Date(timestamp),
      waMessageId: waMessageId || null,  // Store WhatsApp message ID for deduplication
      isFromAi: isFromAi,  // Mark if this is an AI/bot reply
    });

    console.log(`[MessageStorage] ✅ Saved message: ${newMessage.id}, fromMe=${fromMe}, direction=${fromMe ? 'OUTGOING' : 'INCOMING'}, content="${messageBody}"`);

    // Emit to Socket.io for real-time update
    try {
      const socketIO = getIO();

      // Transform message for frontend compatibility (fromMe -> direction)
      const messageForFrontend = {
        ...newMessage,
        direction: newMessage.fromMe ? "outgoing" : "incoming",
      };

      // Emit to user's room (userId-based, e.g., wa:60xxx)
      socketIO.to(`user:${userId}`).emit("message_received", {
        conversation,
        message: messageForFrontend,
      });

      // Also emit globally for all clients (will be filtered by user on frontend)
      socketIO.emit("new_message_global", {
        userId,
        conversation,
        message: messageForFrontend,
      });

      // Also emit to conversation room
      socketIO.to(`conversation:${conversation.id}`).emit("new_message", {
        message: messageForFrontend,
      });

      console.log(`[MessageStorage] 📡 Emitted to Socket.io: user:${userId}, conversation:${conversation.id}`);
    } catch (socketError) {
      console.error("[MessageStorage] ⚠️ Socket.io emit error:", socketError);
      // Don't fail the message save if socket fails
    }

    return {
      conversation,
      message: newMessage,
    };
  } catch (error) {
    console.error("[MessageStorage] ❌ Error saving message:", error);
    return null;
  }
}

/**
 * Save incoming WhatsApp message to database (legacy wrapper)
 * Creates conversation if doesn't exist, adds message
 */
export async function saveIncomingMessage(userId: string, fromJid: string, messageBody: string, timestamp: number = Date.now(), senderName?: string) {
  return await saveMessage(userId, fromJid, messageBody, false, timestamp, senderName);
}

/**
 * Save outgoing message to database
 */
export async function saveOutgoingMessage(userId: string, toJid: string, messageBody: string, timestamp: number = Date.now()) {
  try {
    // Clean JID and normalize using shared utility
    const phoneNumber = normalizePhoneNumber(toJid.replace("@g.us", ""));

    console.log(`[MessageStorage] 💾 Saving outgoing message to ${phoneNumber} from ${userId}`);

    // Find or create conversation (using normalized phone matching)
    const allConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
    });

    let conversation = allConversations.find(c => {
      const existingNormalized = normalizePhoneNumber(c.phoneNumber);
      return existingNormalized === phoneNumber;
    });

    if (!conversation) {
      const newConv = await insertReturningOne(conversations, {
        userId,
        phoneNumber,
        status: "active",
        lastMessageAt: new Date(timestamp),
        lastMessagePreview: messageBody.substring(0, 100),
        unreadCount: 0,
      });
      conversation = newConv;
    } else {
      const updated = await updateReturningOne(
        conversations,
        eq(conversations.id, conversation.id),
        {
          lastMessageAt: new Date(timestamp),
          lastMessagePreview: messageBody.substring(0, 100),
          updatedAt: new Date(),
        }
      );
      conversation = updated;
    }

    // Save the message
    const newMessage = await insertReturningOne(messages, {
      conversationId: conversation.id,
      content: messageBody,
      fromMe: true,
      messageType: "text",
      status: "sent",
      timestamp: new Date(timestamp),
    });

    console.log(`[MessageStorage] ✅ Saved outgoing message: ${newMessage.id}`);

    return {
      conversation,
      message: newMessage,
    };
  } catch (error) {
    console.error("[MessageStorage] ❌ Error saving outgoing message:", error);
    return null;
  }
}
