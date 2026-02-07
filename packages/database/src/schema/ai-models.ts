import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

// AI Models - Custom provider support (user inputs ALL details manually)
export const aiModels = pgTable("ai_models", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // User-provided fields (matches Add AI Model modal)
  alias: text("alias").notNull(),        // "Support Bot" - Model Alias field
  modelName: text("model_name").notNull(), // "gpt-4o", "glm-4.7" - AI Model field
  apiEndpoint: text("api_endpoint").notNull(), // Custom endpoint URL
  apiKey: text("api_key").notNull(),      // Encrypted API key
  systemPrompt: text("system_prompt"),     // Default system prompt

  // Pricing (per 1M tokens) - auto-populated for popular models, user can override
  inputPricePer1M: text("input_price_per_1m").default("0.00"),  // e.g., "0.50" = RM 0.50 per 1M input tokens
  outputPricePer1M: text("output_price_per_1m").default("0.00"), // e.g., "1.50" = RM 1.50 per 1M output tokens

  // Auto-detected/computed
  provider: text("provider"),              // Auto-detect from endpoint or manual
  isActive: boolean("is_active").default(false),
  lastTestedAt: timestamp("last_tested_at"),
  testStatus: text("test_status").default("untested"),         // success | error | untested

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bot Configuration (per-user)
export const botConfig = pgTable("bot_config", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(), // One config per user
  isEnabled: boolean("is_enabled").default(false),
  botMode: text("bot_mode").default("normal"), // normal | ai
  activeModelId: text("active_model_id").references(() => aiModels.id, { onDelete: "set null" }),
  status: text("status").default("stopped"), // running | stopped | restarting
  autoReplyUnknown: boolean("auto_reply_unknown").default(true),
  handoffKeyword: text("handoff_keyword").default("agent"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
