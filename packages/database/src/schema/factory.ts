import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";

type Builder = {
  table: any;
  text: any;
  timestamp: any;
  boolean: any;
  integer: any;
  json: any;
  primaryKey: any;
};

export function createSchema(builder: Builder) {
  const { table, text, timestamp, boolean, integer, json, primaryKey } = builder;

  const users = table("users", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    name: text("name").notNull(),
    email: text("email").unique(),
    emailVerified: boolean("email_verified").default(false),
    image: text("image"),
    role: text("role").notNull().default("admin"),
    dataPath: text("data_path").notNull(),
    displayName: text("display_name"),
    about: text("about"),
    profilePicUrl: text("profile_pic_url"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const sessions = table("sessions", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  });

  const accounts = table("accounts", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const verifications = table("verifications", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const whatsappSessions = table("whatsapp_sessions", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    browserSessionId: text("browser_session_id"),
    phoneNumber: text("phone_number"),
    displayName: text("display_name"),
    about: text("about"),
    profilePicUrl: text("profile_pic_url"),
    status: text("status").notNull().default("disconnected"),
    qrCode: text("qr_code"),
    authData: json("auth_data"),
    isActive: boolean("is_active").default(true),
    lastConnectedAt: timestamp("last_connected_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const tags = table("tags", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("green"),
    createdAt: timestamp("created_at").defaultNow(),
  });

  const contacts = table("contacts", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    phoneNumber: text("phone_number").notNull(),
    customData: json("custom_data"),
    lastMessageAt: timestamp("last_message_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const contactTags = table(
    "contact_tags",
    {
      contactId: text("contact_id")
        .notNull()
        .references(() => contacts.id, { onDelete: "cascade" }),
      tagId: text("tag_id")
        .notNull()
        .references(() => tags.id, { onDelete: "cascade" }),
    },
    (t: any) => [primaryKey({ columns: [t.contactId, t.tagId] })]
  );

  const conversations = table("conversations", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    phoneNumber: text("phone_number").notNull(),
    contactName: text("contact_name"),
    isAiEnabled: boolean("is_ai_enabled").default(false),
    aiContext: text("ai_context"),
    unreadCount: integer("unread_count").default(0),
    lastMessageAt: timestamp("last_message_at"),
    lastMessagePreview: text("last_message_preview"),
    status: text("status").default("active"),
    takeoverMode: boolean("takeover_mode").default(false),
    takeoverExpiresAt: timestamp("takeover_expires_at"),
    takeoverAdminId: text("takeover_admin_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const messages = table("messages", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    waMessageId: text("wa_message_id"),
    content: text("content"),
    fromMe: boolean("from_me").default(false),
    senderName: text("sender_name"),
    messageType: text("message_type").default("text"),
    mediaUrl: text("media_url"),
    mediaCaption: text("media_caption"),
    status: text("status").default("pending"),
    isFromAi: boolean("is_from_ai").default(false),
    inputTokens: integer("input_tokens").default(0),
    outputTokens: integer("output_tokens").default(0),
    aiCost: text("ai_cost"),
    timestamp: timestamp("timestamp").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  });

  const quickReplies = table("quick_replies", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    shortcut: text("shortcut"),
    createdAt: timestamp("created_at").defaultNow(),
  });

  const campaigns = table("campaigns", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    attachments: json("attachments"),
    status: text("status").default("draft"),
    recipientCount: integer("recipient_count").default(0),
    sentCount: integer("sent_count").default(0),
    deliveredCount: integer("delivered_count").default(0),
    failedCount: integer("failed_count").default(0),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    delayMin: integer("delay_min").default(3000),
    delayMax: integer("delay_max").default(10000),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const campaignRecipients = table("campaign_recipients", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    phoneNumber: text("phone_number").notNull(),
    name: text("name"),
    customData: text("custom_data"),
    status: text("status").default("pending"),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    errorMessage: text("error_message"),
  });

  const aiModels = table("ai_models", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    modelName: text("model_name").notNull(),
    apiEndpoint: text("api_endpoint").notNull(),
    apiKey: text("api_key").notNull(),
    systemPrompt: text("system_prompt"),
    inputPricePer1M: text("input_price_per_1m").default("0.00"),
    outputPricePer1M: text("output_price_per_1m").default("0.00"),
    provider: text("provider"),
    isActive: boolean("is_active").default(false),
    lastTestedAt: timestamp("last_tested_at"),
    testStatus: text("test_status").default("untested"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const botConfig = table("bot_config", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    isEnabled: boolean("is_enabled").default(false),
    botMode: text("bot_mode").default("normal"),
    activeModelId: text("active_model_id").references(() => aiModels.id, { onDelete: "set null" }),
    status: text("status").default("stopped"),
    autoReplyUnknown: boolean("auto_reply_unknown").default(true),
    handoffKeyword: text("handoff_keyword").default("agent"),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const knowledgeBase = table("knowledge_base", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    fileType: text("file_type").notNull(),
    filePath: text("file_path"),
    content: text("content"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  });

  const botFiles = table("bot_files", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    folder: text("folder"),
    filePath: text("file_path").notNull(),
    parentPath: text("parent_path").notNull().default("/"),
    isDirectory: boolean("is_directory").default(false),
    fileSize: integer("file_size").default(0),
    content: text("content"),
    mimeType: text("mime_type"),
    botMode: text("bot_mode").default("normal"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const botCommands = table("bot_commands", {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    sessionId: text("session_id")
      .notNull()
      .references(() => whatsappSessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    command: text("command").notNull(),
    alias: json("alias"),
    description: text("description"),
    action: text("action").notNull(),
    adminOnly: boolean("admin_only").default(true),
    hiddenFromContact: boolean("hidden_from_contact").default(true),
    enabled: boolean("enabled").default(true),
    config: json("config"),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  });

  const contactsRelations = relations(contacts, ({ many }) => ({
    tags: many(contactTags),
  }));

  const tagsRelations = relations(tags, ({ many }) => ({
    contacts: many(contactTags),
  }));

  const contactTagsRelations = relations(contactTags, ({ one }) => ({
    contact: one(contacts, {
      fields: [contactTags.contactId],
      references: [contacts.id],
    }),
    tag: one(tags, {
      fields: [contactTags.tagId],
      references: [tags.id],
    }),
  }));

  const conversationsRelations = relations(conversations, ({ one, many }) => ({
    contact: one(contacts, {
      fields: [conversations.contactId],
      references: [contacts.id],
    }),
    messages: many(messages),
  }));

  const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
      fields: [messages.conversationId],
      references: [conversations.id],
    }),
  }));

  const campaignsRelations = relations(campaigns, ({ many }) => ({
    recipients: many(campaignRecipients),
  }));

  const campaignRecipientsRelations = relations(campaignRecipients, ({ one }) => ({
    campaign: one(campaigns, {
      fields: [campaignRecipients.campaignId],
      references: [campaigns.id],
    }),
    contact: one(contacts, {
      fields: [campaignRecipients.contactId],
      references: [contacts.id],
    }),
  }));

  const botCommandsRelations = relations(botCommands, ({ one }) => ({
    session: one(whatsappSessions, {
      fields: [botCommands.sessionId],
      references: [whatsappSessions.id],
    }),
  }));

  return {
    users,
    sessions,
    accounts,
    verifications,
    whatsappSessions,
    tags,
    contacts,
    contactTags,
    conversations,
    messages,
    quickReplies,
    campaigns,
    campaignRecipients,
    aiModels,
    botConfig,
    knowledgeBase,
    botFiles,
    botCommands,
    contactsRelations,
    tagsRelations,
    contactTagsRelations,
    conversationsRelations,
    messagesRelations,
    campaignsRelations,
    campaignRecipientsRelations,
    botCommandsRelations,
  };
}
