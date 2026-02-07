import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { users } from "./users";
import { contacts } from "./contacts";
import { relations } from "drizzle-orm";

// Conversations - matches Chat page
export const conversations = pgTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  phoneNumber: text("phone_number").notNull(), // For unsaved contacts
  contactName: text("contact_name"), // Display name (from contact or WhatsApp)
  isAiEnabled: boolean("is_ai_enabled").default(false),
  aiContext: text("ai_context"), // Summary for AI memory
  unreadCount: integer("unread_count").default(0),
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  status: text("status").default("active"), // active | archived | resolved
  // Takeover mode fields (for /takeover command)
  takeoverMode: boolean("takeover_mode").default(false), // AI is silenced, admin in control
  takeoverExpiresAt: timestamp("takeover_expires_at"), // When takeover auto-expires
  takeoverAdminId: text("takeover_admin_id"), // Admin who initiated takeover
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages - matches Chat page message bubbles
export const messages = pgTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  waMessageId: text("wa_message_id"), // WhatsApp message ID
  content: text("content"),
  fromMe: boolean("from_me").default(false),
  senderName: text("sender_name"),
  messageType: text("message_type").default("text"), // text | image | video | document | audio
  mediaUrl: text("media_url"),
  mediaCaption: text("media_caption"),
  status: text("status").default("pending"), // pending | sent | delivered | read | failed
  isFromAi: boolean("is_from_ai").default(false),
  // AI Token & Cost Tracking
  inputTokens: integer("input_tokens").default(0),      // Tokens used for input/prompt
  outputTokens: integer("output_tokens").default(0),     // Tokens used for AI response
  aiCost: text("ai_cost"),                              // Actual cost in RM (e.g., "0.0123")
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Quick Reply Templates
export const quickReplies = pgTable("quick_replies", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  shortcut: text("shortcut"), // E.g., "/price" triggers this
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [conversations.contactId],
    references: [contacts.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
