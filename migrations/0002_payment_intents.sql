CREATE TABLE IF NOT EXISTS payment_intents (
  payload TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('order','topup','vip')),
  reference_id TEXT,
  amount_stars INTEGER NOT NULL CHECK (amount_stars > 0),
  bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points >= 0),
  plan_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  charge_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(telegram_id, created_at);
