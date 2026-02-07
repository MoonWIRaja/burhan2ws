-- Migration to update bot_files table for file manager
-- Run this in your PostgreSQL database

-- Add new columns to bot_files
ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS parent_path TEXT DEFAULT '/';
ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS is_directory BOOLEAN DEFAULT false;
ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;
ALTER TABLE bot_files ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Make file_path NOT NULL (after adding data)
UPDATE bot_files SET file_path = '/' || folder || '/' || filename WHERE file_path IS NULL;
UPDATE bot_files SET parent_path = '/' || folder WHERE parent_path IS NULL OR parent_path = '/';

-- Drop old folder column (optional - can keep for backward compatibility)
-- ALTER TABLE bot_files DROP COLUMN IF EXISTS folder;
-- ALTER TABLE bot_files DROP COLUMN IF EXISTS description;

-- Make file_path required
ALTER TABLE bot_files ALTER COLUMN file_path SET NOT NULL;
