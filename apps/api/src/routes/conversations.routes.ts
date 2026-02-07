import { Router } from "express";
import { db, conversations, messages, contacts, normalizePhoneNumber, isValidPhoneNumber } from "@whatsapp-blast/database";
import { eq, and, ilike, or, desc, count, sql } from "drizzle-orm";
import { getSessionId, getRealUserId } from "../utils/get-user.js";

const router = Router();

// GET /api/conversations - List all conversations (filtered to valid phone numbers only)
// Also auto-cleanup invalid conversations in background
router.get("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { search, status, page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const userConversations = await db.query.conversations.findMany({
      where: and(
        eq(conversations.userId, userId),
        status ? eq(conversations.status, status as string) : undefined,
        search
          ? or(
              ilike(conversations.contactName, "%" + search + "%"),
              ilike(conversations.phoneNumber, "%" + search + "%")
            )
          : undefined
      ),
      with: {
        contact: true,
      },
      orderBy: [desc(conversations.lastMessageAt)],
      limit: limitNum,
      offset,
    });

    // Filter out conversations with invalid phone numbers
    const validConversations = userConversations.filter(c => isValidPhoneNumber(c.phoneNumber));
    const invalidConversations = userConversations.filter(c => !isValidPhoneNumber(c.phoneNumber));

    // Auto-cleanup invalid conversations in background (non-blocking)
    if (invalidConversations.length > 0) {
      setImmediate(async () => {
        try {
          for (const conv of invalidConversations) {
            await db.delete(conversations).where(eq(conversations.id, conv.id)).execute();
          }
          console.log(`[Cleanup] Auto-deleted ${invalidConversations.length} invalid conversations for user ${userId}`);
        } catch (cleanupError) {
          console.error("[Cleanup] Error auto-deleting:", cleanupError);
        }
      });
    }

    res.json(validConversations);
  } catch (error) {
    console.error("Error listing conversations:", error);
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

// POST /api/conversations - Create a new conversation
router.post("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { phoneNumber, contactName } = req.body;

    if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Check if conversation already exists (with or without @s.whatsapp.net suffix)
    // Get all user conversations and filter by normalized phone number
    const allConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
    });

    const existing = allConversations.find(c => {
      const existingNormalized = normalizePhoneNumber(c.phoneNumber);
      return existingNormalized === normalizedPhone;
    });

    if (existing) {
      // If contactName is provided and different, update the conversation
      if (contactName && existing.contactName !== contactName) {
        const [updated] = await db
          .update(conversations)
          .set({
            contactName: contactName,
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, existing.id))
          .returning();
        return res.json(updated);
      }
      return res.json(existing);
    }

    // Find existing contact (also check with normalized phone number)
    const allContacts = await db.query.contacts.findMany({
      where: eq(contacts.userId, userId),
    });

    let contact = allContacts.find(c => {
      const contactNormalized = normalizePhoneNumber(c.phoneNumber);
      return contactNormalized === normalizedPhone;
    });

    // Create contact if name provided and contact doesn't exist
    if (contactName && !contact) {
      [contact] = await db
        .insert(contacts)
        .values({
          userId,
          phoneNumber: normalizedPhone,
          name: contactName,
        })
        .returning();
    }

    // Create new conversation
    const [newConversation] = await db
      .insert(conversations)
      .values({
        userId,
        phoneNumber: normalizedPhone,
        contactId: contact?.id || null,
        contactName: contact?.name || contactName || null,
        lastMessagePreview: null,
        lastMessageAt: null,
        unreadCount: 0,
        isAiEnabled: false,
        status: "active",
      })
      .returning();

    res.json(newConversation);
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /api/conversations/:id - Get single conversation
router.get("/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, req.params.id),
        eq(conversations.userId, userId)
      ),
      with: {
        contact: true,
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(conversation);
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

// GET /api/conversations/:id/messages - Get messages (paginated)
router.get("/:id/messages", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Verify conversation belongs to user
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, req.params.id),
        eq(conversations.userId, userId)
      ),
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const conversationMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, req.params.id),
      orderBy: [desc(messages.timestamp)],
      limit: limitNum,
      offset,
    });

    const [countResult] = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.conversationId, req.params.id));

    // Transform fromMe to direction for frontend compatibility
    const transformedMessages = conversationMessages.reverse().map(msg => ({
      ...msg,
      direction: msg.fromMe ? "outgoing" : "incoming",
    }));

    res.json({
      messages: transformedMessages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult?.count || 0,
      },
    });
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// PATCH /api/conversations/:id/ai - Toggle AI for conversation
router.patch("/:id/ai", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { enabled } = req.body;

    const [updated] = await db
      .update(conversations)
      .set({
        isAiEnabled: enabled,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, req.params.id), eq(conversations.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error toggling AI:", error);
    res.status(500).json({ error: "Failed to toggle AI" });
  }
});

// POST /api/conversations/:id/takeover - Human takeover from AI
router.post("/:id/takeover", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const [updated] = await db
      .update(conversations)
      .set({
        isAiEnabled: false,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, req.params.id), eq(conversations.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ success: true, conversation: updated });
  } catch (error) {
    console.error("Error taking over:", error);
    res.status(500).json({ error: "Failed to take over conversation" });
  }
});

// PATCH /api/conversations/:id/read - Mark conversation as read
router.patch("/:id/read", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const [updated] = await db
      .update(conversations)
      .set({
        unreadCount: 0,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, req.params.id), eq(conversations.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error marking as read:", error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// PATCH /api/conversations/:id - General update (save contact, etc.)
router.patch("/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { action, contactName } = req.body;

    if (action === "saveContact") {
      // Find or create contact
      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, req.params.id),
          eq(conversations.userId, userId)
        ),
      });

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      let contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.userId, userId),
          eq(contacts.phoneNumber, conversation.phoneNumber)
        ),
      });

      // Update or create contact
      if (contact) {
        [contact] = await db
          .update(contacts)
          .set({
            name: contactName,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contact.id))
          .returning();
      } else {
        [contact] = await db
          .insert(contacts)
          .values({
            userId,
            phoneNumber: conversation.phoneNumber,
            name: contactName,
          })
          .returning();
      }

      // Update conversation with contact info
      const [updated] = await db
        .update(conversations)
        .set({
          contactId: contact.id,
          contactName: contactName,
          updatedAt: new Date(),
        })
        .where(and(eq(conversations.id, req.params.id), eq(conversations.userId, userId)))
        .returning();

      return res.json(updated);
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (error) {
    console.error("Error updating conversation:", error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

// DELETE /api/conversations/cleanup - Delete all conversations with invalid phone numbers
router.delete("/cleanup", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    // Get all conversations for this user
    const allConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
    });

    // Filter invalid phone numbers
    const invalidConversations = allConversations.filter(c => !isValidPhoneNumber(c.phoneNumber));

    if (invalidConversations.length === 0) {
      return res.json({ deleted: 0, message: "No invalid conversations found" });
    }

    // Delete invalid conversations (cascade will delete their messages)
    for (const conv of invalidConversations) {
      await db.delete(conversations).where(eq(conversations.id, conv.id)).execute();
    }

    console.log(`[Cleanup] Deleted ${invalidConversations.length} invalid conversations for user ${userId}`);

    res.json({
      deleted: invalidConversations.length,
      message: `Deleted ${invalidConversations.length} invalid conversations`,
      deletedIds: invalidConversations.map(c => c.id),
    });
  } catch (error) {
    console.error("Error cleaning up conversations:", error);
    res.status(500).json({ error: "Failed to cleanup conversations" });
  }
});

// DELETE /api/conversations/clear-all - Delete ALL conversations and messages (for testing/debug)
router.delete("/clear-all", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    // Delete all messages for this user's conversations (cascade)
    const allConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
    });

    for (const conv of allConversations) {
      await db.delete(conversations).where(eq(conversations.id, conv.id)).execute();
    }

    console.log(`[Cleanup] Cleared all ${allConversations.length} conversations for user ${userId}`);

    res.json({
      deleted: allConversations.length,
      message: `Deleted all ${allConversations.length} conversations and their messages`,
    });
  } catch (error) {
    console.error("Error clearing all conversations:", error);
    res.status(500).json({ error: "Failed to clear conversations" });
  }
});

export default router;
