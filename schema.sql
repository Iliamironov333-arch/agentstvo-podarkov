-- Полная схема D1 «Агентства подарков», синхронизированная с фактической структурой базы.
-- Содержит определения таблиц и индексов; данные пользователей и заказов сюда не входят.
-- Для существующей базы применяйте миграции, не удаляйте таблицы и данные.

CREATE TABLE IF NOT EXISTS admin_action_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_telegram_id TEXT NOT NULL, target_telegram_id TEXT, action_type TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS admin_staff (
  telegram_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner','moderator','client')),
  permissions_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 100), body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 3000), link_url TEXT, starts_at TEXT, ends_at TEXT, audience_type TEXT NOT NULL DEFAULT 'all' CHECK(audience_type IN ('all','selected')), audience_ids TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')), created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS app_settings (     key TEXT PRIMARY KEY,     value TEXT NOT NULL,     updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );

CREATE TABLE IF NOT EXISTS balance_transactions (     id INTEGER PRIMARY KEY AUTOINCREMENT,     telegram_id TEXT NOT NULL,     amount_stars INTEGER NOT NULL,     operation_type TEXT NOT NULL,     description TEXT,     idempotency_key TEXT NOT NULL UNIQUE,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) );

CREATE TABLE IF NOT EXISTS campaign_recipients (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, telegram_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','uncertain')), attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, sent_at TEXT, started_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(campaign_id, telegram_id), FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 100), body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), audience_type TEXT NOT NULL CHECK(audience_type IN ('all','buyers','inactive','selected')), audience_ids TEXT NOT NULL DEFAULT '[]', media_url TEXT, button_text TEXT, button_url TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','queued','sending','completed','partial')), created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS custom_orders (id TEXT PRIMARY KEY, telegram_id TEXT NOT NULL, username TEXT, first_name TEXT, subject TEXT NOT NULL, answers_json TEXT NOT NULL, total_stars INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS favorites (     telegram_id TEXT NOT NULL,     product_id TEXT NOT NULL,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     PRIMARY KEY (telegram_id, product_id),     FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),     FOREIGN KEY (product_id) REFERENCES products(id) );

CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, product_id TEXT NOT NULL, product_title TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0), image_url TEXT, delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sending','sent')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, delivered_at TEXT, delivery_started_at TEXT, FOREIGN KEY (order_id) REFERENCES orders(id), FOREIGN KEY (product_id) REFERENCES products(id));

CREATE TABLE IF NOT EXISTS orders (     id TEXT PRIMARY KEY,     telegram_id TEXT NOT NULL,     product_id TEXT,     product_title TEXT NOT NULL,     quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),     price_stars INTEGER NOT NULL CHECK (price_stars >= 0),     discount_percent INTEGER NOT NULL DEFAULT 0,     total_stars INTEGER NOT NULL CHECK (total_stars >= 0),     payment_status TEXT NOT NULL DEFAULT 'pending'         CHECK (payment_status IN ('pending','paid','cancelled','refunded')),     fulfillment_status TEXT NOT NULL DEFAULT 'awaiting_payment'         CHECK (fulfillment_status IN ('awaiting_payment','awaiting_delivery','delivered','cancelled')),     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     paid_at TEXT,     delivered_at TEXT, promo_code TEXT, discount_stars INTEGER NOT NULL DEFAULT 0,     FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),     FOREIGN KEY (product_id) REFERENCES products(id) );

CREATE TABLE IF NOT EXISTS payment_intents (payload TEXT PRIMARY KEY, telegram_id TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('order','topup','vip')), reference_id TEXT, amount_stars INTEGER NOT NULL CHECK (amount_stars > 0), bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points >= 0), plan_type TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')), charge_id TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT, FOREIGN KEY (telegram_id) REFERENCES users(telegram_id));

CREATE TABLE IF NOT EXISTS payments (     id INTEGER PRIMARY KEY AUTOINCREMENT,     order_id TEXT NOT NULL UNIQUE,     telegram_id TEXT NOT NULL,     telegram_payment_charge_id TEXT UNIQUE,     currency TEXT NOT NULL DEFAULT 'XTR'         CHECK (currency = 'XTR'),     amount_stars INTEGER NOT NULL CHECK (amount_stars > 0),     status TEXT NOT NULL DEFAULT 'pending'         CHECK (status IN ('pending','paid','refunded','failed')),     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     confirmed_at TEXT,     FOREIGN KEY (order_id) REFERENCES orders(id),     FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) );

CREATE TABLE IF NOT EXISTS products (     id TEXT PRIMARY KEY,     title TEXT NOT NULL,     description TEXT,     image_url TEXT,     category TEXT,     price_stars INTEGER NOT NULL CHECK (price_stars >= 0),     is_active INTEGER NOT NULL DEFAULT 1,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );

CREATE TABLE IF NOT EXISTS promo_codes (code TEXT PRIMARY KEY, discount_percent INTEGER NOT NULL CHECK(discount_percent BETWEEN 1 AND 90), max_uses INTEGER, reserved_count INTEGER NOT NULL DEFAULT 0, redeemed_count INTEGER NOT NULL DEFAULT 0, starts_at TEXT, ends_at TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, product_ids TEXT NOT NULL DEFAULT '[]', category_ids TEXT NOT NULL DEFAULT '[]', CHECK(max_uses IS NULL OR max_uses >= 1));

CREATE TABLE IF NOT EXISTS promo_redemptions (order_id TEXT PRIMARY KEY, code TEXT NOT NULL, telegram_id TEXT NOT NULL, discount_stars INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','paid','released')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT);

CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS support_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, sender_type TEXT NOT NULL DEFAULT 'ai',
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE TABLE IF NOT EXISTS support_conversation_controls (telegram_id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'ai' CHECK(mode IN ('ai','human')), updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (telegram_id) REFERENCES users(telegram_id));

CREATE TABLE IF NOT EXISTS support_internal_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL, admin_telegram_id TEXT NOT NULL, note TEXT NOT NULL CHECK(length(note) BETWEEN 2 AND 2000), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (telegram_id) REFERENCES users(telegram_id));

CREATE TABLE IF NOT EXISTS support_messages (     id INTEGER PRIMARY KEY AUTOINCREMENT,     telegram_id TEXT NOT NULL,     message TEXT NOT NULL,     status TEXT NOT NULL DEFAULT 'open'         CHECK (status IN ('open','in_progress','closed')),     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) );

CREATE TABLE IF NOT EXISTS system_error_log (id INTEGER PRIMARY KEY AUTOINCREMENT, severity TEXT NOT NULL DEFAULT 'error' CHECK(severity IN ('info','warning','error','critical')), source TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','resolved')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT);

CREATE TABLE IF NOT EXISTS user_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL, block_type TEXT NOT NULL CHECK(block_type IN ('purchases','full')), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','lifted')), blocked_by TEXT NOT NULL, blocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, unblocked_by TEXT, unblocked_at TEXT);

CREATE TABLE IF NOT EXISTS users (     telegram_id TEXT PRIMARY KEY,     username TEXT,     first_name TEXT,     balance_stars INTEGER NOT NULL DEFAULT 0,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );

CREATE TABLE IF NOT EXISTS vip_subscriptions (     id INTEGER PRIMARY KEY AUTOINCREMENT,     telegram_id TEXT NOT NULL,     plan_type TEXT NOT NULL         CHECK (plan_type IN ('subscription','lifetime')),     status TEXT NOT NULL DEFAULT 'active'         CHECK (status IN ('active','expired','cancelled')),     starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     expires_at TEXT,     order_id TEXT,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),     FOREIGN KEY (order_id) REFERENCES orders(id) );

CREATE INDEX IF NOT EXISTS idx_admin_action_log_created ON admin_action_log(id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_action_log_target ON admin_action_log(target_telegram_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_staff_role_status ON admin_staff(role,status);

CREATE INDEX IF NOT EXISTS idx_announcements_status_dates ON announcements(status, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_balance_user ON balance_transactions(telegram_id,id);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_queue ON campaign_recipients(status, campaign_id, id);

CREATE INDEX IF NOT EXISTS idx_campaigns_status_created ON campaigns(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_orders_user ON custom_orders(telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id, id);

CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(payment_status, fulfillment_status);

CREATE INDEX IF NOT EXISTS idx_orders_user     ON orders(telegram_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(telegram_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payments_user     ON payments(telegram_id, created_at);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active,created_at);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_redemptions(code,status);

CREATE INDEX IF NOT EXISTS idx_support_chat_user ON support_chat_messages(telegram_id, id);

CREATE INDEX IF NOT EXISTS idx_support_internal_notes_user ON support_internal_notes(telegram_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_support_user ON support_messages(telegram_id,created_at);

CREATE INDEX IF NOT EXISTS idx_system_error_log_status_created ON system_error_log(status,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_blocks_history ON user_blocks(telegram_id, blocked_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_blocks_one_active ON user_blocks(telegram_id) WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_vip_user ON vip_subscriptions(telegram_id,id);

CREATE INDEX IF NOT EXISTS idx_vip_user_status     ON vip_subscriptions(telegram_id, status);
