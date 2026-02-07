-- Add bot_mode column to bot_config table
ALTER TABLE bot_config ADD COLUMN IF NOT EXISTS bot_mode TEXT DEFAULT 'normal';

-- Add bot_mode column to bot_files table
ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS bot_mode TEXT DEFAULT 'normal';

-- Update existing records to have default value
UPDATE bot_config SET bot_mode = 'normal' WHERE bot_mode IS NULL;
UPDATE bot_files SET bot_mode = 'normal' WHERE bot_mode IS NULL;
