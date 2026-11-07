CREATE TABLE IF NOT EXISTS user_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  block_type TEXT NOT NULL CHECK(block_type IN ('purchases','full')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','lifted')),
  blocked_by TEXT NOT NULL,
  blocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unblocked_by TEXT,
  unblocked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocks_one_active
  ON user_blocks(telegram_id) WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_user_blocks_history
  ON user_blocks(telegram_id, blocked_at DESC);
