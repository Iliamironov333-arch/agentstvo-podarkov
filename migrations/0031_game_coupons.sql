-- Add owner-granted GAME coupons to the existing bonus inventory.
ALTER TABLE user_bonus_balances ADD COLUMN game_coupons INTEGER NOT NULL DEFAULT 0 CHECK (game_coupons >= 0);

-- Extend the bonus ledger's allowed types without losing existing history.
-- Drop the old index first so it is recreated on the replacement table, not the legacy table.
DROP INDEX IF EXISTS idx_bonus_transactions_user;
ALTER TABLE bonus_transactions RENAME TO bonus_transactions_legacy;
CREATE TABLE bonus_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  actor_telegram_id TEXT,
  bonus_type TEXT NOT NULL CHECK (bonus_type IN ('priority_order','vip_days','campaign_priority','extra_attempt','game_coupon')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('grant','sale')),
  stars_amount INTEGER NOT NULL DEFAULT 0 CHECK (stars_amount >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
INSERT INTO bonus_transactions(id,telegram_id,actor_telegram_id,bonus_type,quantity,operation_type,stars_amount,idempotency_key,created_at)
SELECT id,telegram_id,actor_telegram_id,bonus_type,quantity,operation_type,stars_amount,idempotency_key,created_at FROM bonus_transactions_legacy;
DROP TABLE bonus_transactions_legacy;
CREATE INDEX IF NOT EXISTS idx_bonus_transactions_user ON bonus_transactions(telegram_id, created_at DESC);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0031_game_coupons');
