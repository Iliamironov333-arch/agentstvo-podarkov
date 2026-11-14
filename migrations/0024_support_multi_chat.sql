-- Multi-chat support for standard and VIP assistants.
-- Apply once to the existing D1 database; preserves all previous messages.
ALTER TABLE support_chat_messages ADD COLUMN conversation_id TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE support_chat_messages ADD COLUMN assistant_type TEXT NOT NULL DEFAULT 'standard'
  CHECK (assistant_type IN ('standard','vip'));

CREATE TABLE IF NOT EXISTS support_conversations (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  assistant_type TEXT NOT NULL CHECK (assistant_type IN ('standard','vip')),
  title TEXT NOT NULL DEFAULT 'Новый диалог',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_support_conversations_user
  ON support_conversations(telegram_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_conversation
  ON support_chat_messages(telegram_id, conversation_id, id);

UPDATE support_chat_messages
SET conversation_id = 'legacy-' || telegram_id
WHERE conversation_id = 'legacy';

INSERT OR IGNORE INTO support_conversations
  (id, telegram_id, assistant_type, title, created_at, updated_at)
SELECT 'legacy-' || telegram_id, telegram_id, 'standard', 'Старый диалог',
       MIN(created_at), MAX(created_at)
FROM support_chat_messages
GROUP BY telegram_id;

INSERT OR IGNORE INTO schema_migrations(version) VALUES('0024_support_multi_chat');
