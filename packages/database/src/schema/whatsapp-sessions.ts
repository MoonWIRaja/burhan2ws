import { createId } from "@paralleldrive/cuid2";
import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

// WhatsApp session storage for Baileys
export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  browserSessionId: text("browser_session_id"), // Track the original browser session (cookie) for lookups
  phoneNumber: text("phone_number"),
  displayName: text("display_name"),
  about: text("about"),
  profilePicUrl: text("profile_pic_url"),
  status: text("status").notNull().default("disconnected"), // connected | disconnected | connecting | qr_pending
  qrCode: text("qr_code"),
  authData: jsonb("auth_data"), // Encrypted Baileys credentials
  isActive: boolean("is_active").default(true),
  lastConnectedAt: timestamp("last_connected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
