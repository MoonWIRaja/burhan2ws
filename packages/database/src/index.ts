import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import postgres from "postgres";
import mysql from "mysql2/promise";
import * as schema from "./schema/index.js";
import { databaseUrl, dbProvider } from "./config.js";

console.log("📦 Database provider:", dbProvider);
console.log("📦 Database connecting to:", databaseUrl.replace(/:[^:@]+@/, ":****@"));

let db: any;
let migrationClient: any;

if (dbProvider === "mysql") {
  const queryClient = mysql.createPool(databaseUrl);
  db = drizzleMysql(queryClient, { schema, mode: "default" });
  migrationClient = queryClient;
} else {
  const queryClient = postgres(databaseUrl);
  db = drizzlePostgres(queryClient, { schema });
  migrationClient = postgres(databaseUrl, { max: 1 });
}

export { db, migrationClient, dbProvider, databaseUrl };

// Export schema for external use
export * from "./schema/index.js";
export type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Export phone utilities for consistent normalization
export * from "./utils/phone.js";
