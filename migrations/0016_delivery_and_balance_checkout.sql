-- Delivery details and internal-balance checkout
ALTER TABLE orders ADD COLUMN balance_applied_stars INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_delivery (
  order_id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  address TEXT NOT NULL,
  delivery_details TEXT,
  delivery_note TEXT,
  distance_km REAL NOT NULL,
  delivery_stars INTEGER NOT NULL,
  priority_delivery INTEGER NOT NULL DEFAULT 0,
  priority_stars INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_order_delivery_telegram_id
  ON order_delivery(telegram_id);
