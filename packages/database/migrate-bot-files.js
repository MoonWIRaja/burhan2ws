// Quick migration script for bot_files table
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://burhan2ws:burhan2ws@localhost:5432/burhan2ws";

async function migrate() {
  const sql = postgres(DATABASE_URL);
  
  try {
    console.log("🔄 Running bot_files migration...");
    
    // Add new columns
    await sql`ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS file_path text`;
    console.log("✓ Added file_path column");
    
    await sql`ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS parent_path text DEFAULT '/'`;
    console.log("✓ Added parent_path column");
    
    await sql`ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS is_directory boolean DEFAULT false`;
    console.log("✓ Added is_directory column");
    
    await sql`ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS file_size integer DEFAULT 0`;
    console.log("✓ Added file_size column");
    
    await sql`ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS mime_type text`;
    console.log("✓ Added mime_type column");
    
    // Update existing rows if any
    await sql`UPDATE bot_files SET file_path = '/' || filename WHERE file_path IS NULL`;
    await sql`UPDATE bot_files SET parent_path = '/' WHERE parent_path IS NULL`;
    console.log("✓ Updated existing rows");
    
    console.log("\n✅ Migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration error:", error.message);
  } finally {
    await sql.end();
  }
}

migrate();
