-- 0027: persistent multi-chat storage for support and AI workshop.
-- Existing support messages are preserved and copied into a legacy conversation.
-- Existing AI workshop drafts remain in ai_order_drafts and are not modified by this migration.

CREATE TABLE IF NOT EXISTS assistant_conversations (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  assistant_kind TEXT NOT NULL CHECK (assistant_kind IN ('support','workshop')),
  assistant_tier TEXT NOT NULL DEFAULT 'standard' CHECK (assistant_tier IN ('standard','vip')),
  title TEXT NOT NULL DEFAULT 'Новый диалог',
  source_draft_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE TABLE IF NOT EXISTS assistant_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','owner')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 7000),
  actions_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user_kind
  ON assistant_conversations(telegram_id, assistant_kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation
  ON assistant_chat_messages(conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_messages_user
  ON assistant_chat_messages(telegram_id, created_at DESC);

INSERT OR IGNORE INTO assistant_conversations
  (id, telegram_id, assistant_kind, assistant_tier, title, created_at, updated_at)
SELECT
  'legacy-support-' || telegram_id,
  telegram_id,
  'support',
  'standard',
  'Предыдущий диалог',
  COALESCE(MIN(created_at), CURRENT_TIMESTAMP),
  COALESCE(MAX(created_at), CURRENT_TIMESTAMP)
FROM support_chat_messages
GROUP BY telegram_id;

INSERT OR IGNORE INTO assistant_chat_messages
  (conversation_id, telegram_id, role, content, created_at)
SELECT
  'legacy-support-' || telegram_id,
  telegram_id,
  role,
  content,
  created_at
FROM support_chat_messages;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0027_assistant_saved_chats');
