import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";
import { relations } from "drizzle-orm";

// Tags table
export const tags = pgTable("tags", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("green"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contact management
export const contacts = pgTable("contacts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name"),
  phoneNumber: text("phone_number").notNull(),
  customData: jsonb("custom_data").$type<Record<string, string>>(), // {{nama}}, {{company}}, etc.
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact-Tags junction table
export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.tagId] })]
);

// Relations
export const contactsRelations = relations(contacts, ({ many }) => ({
  tags: many(contactTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  contacts: many(contactTags),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, {
    fields: [contactTags.tagId],
    references: [tags.id],
  }),
}));
