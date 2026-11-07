-- Human takeover for existing AI support conversations.
-- Apply only after reviewing the deployment plan.
ALTER TABLE support_chat_messages ADD COLUMN sender_type TEXT NOT NULL DEFAULT 'ai';

CREATE TABLE IF NOT EXISTS support_conversation_controls (
  telegram_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'ai' CHECK (mode IN ('ai','human')),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
