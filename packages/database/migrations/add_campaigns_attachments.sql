-- Add attachments column to campaigns table for multiple file support
-- This column stores a JSON array of attachment objects: [{ name, type, url, size }]
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS attachments json;
