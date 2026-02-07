import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from root directory (monorepo root)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

// Create connection
const connectionString = process.env.DATABASE_URL || "postgresql://localhost:5432/whatsapp_blast";

console.log("📦 Database connecting to:", connectionString.replace(/:[^:@]+@/, ":****@"));

// For query purposes
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

// For migrations (use a separate client)
export const migrationClient = postgres(connectionString, { max: 1 });

// Export schema for external use
export * from "./schema/index.js";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Export phone utilities for consistent normalization
export * from "./utils/phone.js";
