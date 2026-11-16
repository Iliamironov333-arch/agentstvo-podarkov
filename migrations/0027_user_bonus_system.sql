-- User bonus inventory, grants, and sales ledger
CREATE TABLE IF NOT EXISTS user_bonus_balances (
  telegram_id TEXT PRIMARY KEY,
  priority_order_coupons INTEGER NOT NULL DEFAULT 0 CHECK (priority_order_coupons >= 0),
  vip_days INTEGER NOT NULL DEFAULT 0 CHECK (vip_days >= 0),
  campaign_priority INTEGER NOT NULL DEFAULT 0 CHECK (campaign_priority >= 0),
  extra_attempts INTEGER NOT NULL DEFAULT 0 CHECK (extra_attempts >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE TABLE IF NOT EXISTS bonus_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  actor_telegram_id TEXT,
  bonus_type TEXT NOT NULL CHECK (bonus_type IN ('priority_order','vip_days','campaign_priority','extra_attempt')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('grant','sale')),
  stars_amount INTEGER NOT NULL DEFAULT 0 CHECK (stars_amount >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_bonus_transactions_user
  ON bonus_transactions(telegram_id, created_at DESC);

INSERT OR IGNORE INTO schema_migrations(version) VALUES('0027_user_bonus_system');
