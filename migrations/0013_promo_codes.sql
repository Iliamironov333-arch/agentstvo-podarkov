-- Owner-managed promo codes with atomic usage reservations for Telegram Stars orders.
ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN discount_stars INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  max_uses INTEGER,
  reserved_count INTEGER NOT NULL DEFAULT 0,
  redeemed_count INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (max_uses IS NULL OR max_uses >= 1)
);
CREATE TABLE IF NOT EXISTS promo_redemptions (
  order_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  discount_stars INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','paid','released')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_redemptions(code,status);
