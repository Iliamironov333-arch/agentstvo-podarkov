-- Полная схема D1 для Worker агентства подарков.
-- Все операции используют IF NOT EXISTS, существующие данные сохраняются.

CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  balance_stars INTEGER NOT NULL DEFAULT 0 CHECK (balance_stars >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,
  price_stars INTEGER NOT NULL CHECK (price_stars >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL,
  product_id TEXT,
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_stars INTEGER NOT NULL CHECK (price_stars >= 0),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  total_stars INTEGER NOT NULL CHECK (total_stars >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  fulfillment_status TEXT NOT NULL DEFAULT 'awaiting_payment',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  delivered_at TEXT
);

CREATE TABLE IF NOT EXISTS favorites (
  telegram_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (telegram_id, product_id)
);

CREATE TABLE IF NOT EXISTS balance_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  amount_stars INTEGER NOT NULL,
  operation_type TEXT NOT NULL,
  description TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  telegram_id TEXT NOT NULL,
  telegram_payment_charge_id TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'XTR',
  amount_stars INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vip_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly','lifetime')),
  status TEXT NOT NULL DEFAULT 'pending',
  starts_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','admin')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (telegram_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_user ON support_messages (telegram_id, created_at);
CREATE INDEX IF NOT EXISTS idx_balance_user ON balance_transactions (telegram_id, id);
CREATE INDEX IF NOT EXISTS idx_vip_user ON vip_subscriptions (telegram_id, id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active, created_at);
