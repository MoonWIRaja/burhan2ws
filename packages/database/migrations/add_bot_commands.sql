-- Add bot_commands table for slash commands (AI Mode only)
CREATE TABLE IF NOT EXISTS bot_commands (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  alias JSONB,
  description TEXT,
  action TEXT NOT NULL,
  admin_only BOOLEAN DEFAULT true,
  hidden_from_contact BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  config JSONB,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for session
CREATE INDEX IF NOT EXISTS idx_bot_commands_session ON bot_commands(session_id);

-- Add takeover columns to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS takeover_mode BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeover_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS takeover_admin_id TEXT;

-- Create index for takeover mode queries
CREATE INDEX IF NOT EXISTS idx_conversations_takeover ON conversations(takeover_mode) WHERE takeover_mode = true;
