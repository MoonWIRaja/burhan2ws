import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { users } from "./users";

// Knowledge Base - matches Bot Studio sidebar
export const knowledgeBase = pgTable("knowledge_base", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fileType: text("file_type").notNull(), // PDF | TXT | XLSX | URL
  filePath: text("file_path"),
  content: text("content"), // Extracted text content
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Bot Flow Files - Pterodactyl-style file manager
export const botFiles = pgTable("bot_files", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  folder: text("folder"), // Legacy column - for backward compatibility, use parentPath instead
  filePath: text("file_path").notNull(), // Full path from root: /flows/greeting.js
  parentPath: text("parent_path").notNull().default("/"), // Parent directory: /flows
  isDirectory: boolean("is_directory").default(false),
  fileSize: integer("file_size").default(0),
  content: text("content"), // File content for text files
  mimeType: text("mime_type"), // application/json, text/plain, etc.
  botMode: text("bot_mode").default("normal"), // normal | ai - which mode this file belongs to
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
