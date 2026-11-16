-- 0026: archive support conversations instead of deleting their message history.
ALTER TABLE support_conversations ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_support_conversations_deleted ON support_conversations(telegram_id, deleted_at, updated_at DESC);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0026_support_soft_delete');
