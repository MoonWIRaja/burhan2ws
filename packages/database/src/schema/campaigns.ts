import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, integer, json } from "drizzle-orm/pg-core";
import { users } from "./users";
import { contacts } from "./contacts";
import { relations } from "drizzle-orm";

// Campaigns - matches Blast page
export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  mediaUrl: text("media_url"), // Deprecated - use attachments instead
  mediaType: text("media_type"), // Deprecated - use attachments instead
  attachments: json("attachments").$type<{ name: string; type: string; url: string; size: number }[]>(), // Multiple attachments support
  status: text("status").default("draft"), // draft | scheduled | running | paused | completed | failed | partial
  recipientCount: integer("recipient_count").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  failedCount: integer("failed_count").default(0),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  delayMin: integer("delay_min").default(3000), // ms between sends
  delayMax: integer("delay_max").default(10000),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaign Recipients
export const campaignRecipients = pgTable("campaign_recipients", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  phoneNumber: text("phone_number").notNull(),
  name: text("name"),
  customData: text("custom_data"), // JSON string for personalization
  status: text("status").default("pending"), // pending | sent | delivered | read | failed
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
});

// Relations
export const campaignsRelations = relations(campaigns, ({ many }) => ({
  recipients: many(campaignRecipients),
}));

export const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignRecipients.campaignId],
    references: [campaigns.id],
  }),
  contact: one(contacts, {
    fields: [campaignRecipients.contactId],
    references: [contacts.id],
  }),
}));
