-- Add token tracking fields to messages table for accurate AI cost calculation
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_from_ai BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost TEXT;

-- Create index for AI message queries
CREATE INDEX IF NOT EXISTS idx_messages_is_from_ai ON messages(is_from_ai) WHERE is_from_ai = true;

-- Add pricing fields to ai_models table for cost calculation
ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS input_price_per_1m TEXT DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS output_price_per_1m TEXT DEFAULT '0.00';
