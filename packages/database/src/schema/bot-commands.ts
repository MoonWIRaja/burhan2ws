import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { whatsappSessions } from "./whatsapp-sessions";
import { relations } from "drizzle-orm";

/**
 * Slash Commands for AI Mode
 * Commands are triggered from WhatsApp by admin
 * Commands are hidden from regular contacts
 */
export const botCommands = pgTable("bot_commands", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  sessionId: text("session_id")
    .notNull()
    .references(() => whatsappSessions.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "takeover", "give"
  command: text("command").notNull(), // e.g., "/takeover", "/give"
  alias: jsonb("alias").$type<string[]>(), // e.g., ["/take", "/to", "/ambil"]
  description: text("description"),
  action: text("action").notNull(), // e.g., "TAKEOVER_1HOUR", "GIVE_IMMEDIATE"
  adminOnly: boolean("admin_only").default(true),
  hiddenFromContact: boolean("hidden_from_contact").default(true),
  enabled: boolean("enabled").default(true),
  config: jsonb("config").$type<{
    durationMinutes?: number;
    resetOnAdminChat?: boolean;
    customResponse?: string;
  }>(),
  isDefault: boolean("is_default").default(false), // Default commands (takeover, give)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const botCommandsRelations = relations(botCommands, ({ one }) => ({
  session: one(whatsappSessions, {
    fields: [botCommands.sessionId],
    references: [whatsappSessions.id],
  }),
}));
