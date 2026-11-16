CREATE TABLE IF NOT EXISTS reputation_group_message_activity (
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  telegram_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(chat_id,message_id)
);
CREATE INDEX IF NOT EXISTS idx_reputation_group_activity_user_time
  ON reputation_group_message_activity(telegram_id,created_at DESC);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0030_reputation_group_activity');