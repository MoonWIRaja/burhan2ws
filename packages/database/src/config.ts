import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export type SupportedDbProvider = "postgresql" | "mysql";

export function getDbProvider(): SupportedDbProvider {
  const provider = (process.env.DB_PROVIDER || "postgresql").toLowerCase();
  return provider === "mysql" ? "mysql" : "postgresql";
}

export function getDatabaseUrl(): string {
  const provider = getDbProvider();
  const fallback =
    provider === "mysql"
      ? "mysql://root:password@localhost:3306/whatsapp_blast"
      : "postgresql://localhost:5432/whatsapp_blast";

  return process.env.DATABASE_URL || fallback;
}

export const dbProvider = getDbProvider();
export const databaseUrl = getDatabaseUrl();
