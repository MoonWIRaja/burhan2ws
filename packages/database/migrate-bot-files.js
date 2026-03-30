// Quick migration script for bot_files table
import postgres from "postgres";
import mysql from "mysql2/promise";
import { databaseUrl, dbProvider } from "./src/config.ts";

async function migrate() {
  const client = dbProvider === "mysql"
    ? await mysql.createConnection(databaseUrl)
    : postgres(databaseUrl);
  
  try {
    console.log(`🔄 Running bot_files migration for ${dbProvider}...`);

    const statements = [
      "ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS file_path text",
      "ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS parent_path text DEFAULT '/'",
      "ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS is_directory boolean DEFAULT false",
      "ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS file_size integer DEFAULT 0",
      "ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS mime_type text",
      "UPDATE bot_files SET file_path = CONCAT('/', filename) WHERE file_path IS NULL",
      "UPDATE bot_files SET parent_path = '/' WHERE parent_path IS NULL",
    ];
    
    for (const statement of statements) {
      if (dbProvider === "mysql") {
        await client.execute(statement);
      } else {
        await client.unsafe(statement);
      }
    }
    console.log("✓ Updated existing rows");
    
    console.log("\n✅ Migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration error:", error.message);
  } finally {
    if (dbProvider === "mysql") {
      await client.end();
    } else {
      await client.end();
    }
  }
}

migrate();
