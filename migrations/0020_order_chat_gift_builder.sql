-- 0019: сопровождение заказов и конструктор подарочных наборов.
-- Безопасная миграция: только новые таблицы, существующие заказы и платежи не изменяются.
CREATE TABLE IF NOT EXISTS gift_bundles (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  order_id TEXT,
  title TEXT NOT NULL DEFAULT 'Подарочный набор',
  bundle_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','ordered','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gift_bundles_user ON gift_bundles(telegram_id,created_at DESC);

CREATE TABLE IF NOT EXISTS order_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK(sender_type IN ('buyer','ai','owner','system')),
  content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 4000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_chat_order ON order_chat_messages(order_id,id);

CREATE TABLE IF NOT EXISTS order_change_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  proposed_json TEXT NOT NULL,
  ai_summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
  resolved_by TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_changes_order ON order_change_requests(order_id,created_at DESC);

CREATE TABLE IF NOT EXISTS order_cancellation_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected')),
  resolved_by TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_order ON order_cancellation_requests(order_id,created_at DESC);

INSERT OR IGNORE INTO schema_migrations(version) VALUES('0020_order_chat_gift_builder');

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_cancellations_pending_unique ON order_cancellation_requests(order_id) WHERE status='requested';
