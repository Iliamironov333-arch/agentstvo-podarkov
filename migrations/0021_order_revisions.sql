-- 0021: журнал версий заказов.
CREATE TABLE IF NOT EXISTS order_revisions (
  id TEXT PRIMARY KEY,
  previous_order_id TEXT NOT NULL,
  new_order_id TEXT NOT NULL UNIQUE,
  change_request_id TEXT NOT NULL UNIQUE,
  telegram_id TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  change_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_revisions_previous ON order_revisions(previous_order_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_revisions_customer ON order_revisions(telegram_id,created_at DESC);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0021_order_revisions');
