-- AI moderator, group orders and weekly reports.
CREATE TABLE IF NOT EXISTS ai_moderator_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1,
  complaints_enabled INTEGER NOT NULL DEFAULT 1,
  settings_json TEXT NOT NULL DEFAULT '{}',
  group_chat_id TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO ai_moderator_settings (id, enabled, complaints_enabled, settings_json)
VALUES (1, 1, 1, '{}');

CREATE TABLE IF NOT EXISTS ai_moderation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT,
  actor_telegram_id TEXT,
  target_telegram_id TEXT,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_events_created ON ai_moderation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_events_target ON ai_moderation_events(target_telegram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  source_message_id INTEGER,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active_until TEXT NOT NULL,
  cancelled_at TEXT,
  cancelled_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_warnings_active ON ai_warnings(telegram_id, active_until, cancelled_at);

CREATE TABLE IF NOT EXISTS ai_watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')),
  extended_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ai_watchlist_active ON ai_watchlist(chat_id, telegram_id, status, expires_at);

CREATE TABLE IF NOT EXISTS ai_group_members (
  chat_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(chat_id, telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_group_members_name ON ai_group_members(chat_id, username, first_name, last_name);

CREATE TABLE IF NOT EXISTS ai_group_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  message_id INTEGER,
  telegram_id TEXT,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_group_messages_context ON ai_group_messages(chat_id, telegram_id, id DESC);

CREATE TABLE IF NOT EXISTS ai_complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  reporter_telegram_id TEXT NOT NULL,
  target_telegram_id TEXT,
  target_label TEXT,
  reason TEXT,
  source_message_id INTEGER,
  status TEXT NOT NULL DEFAULT 'review' CHECK(status IN ('review','resolved','dismissed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_complaints_status ON ai_complaints(status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_order_drafts (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  username TEXT,
  first_name TEXT,
  subject TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  estimated_stars INTEGER NOT NULL DEFAULT 0,
  approved_stars INTEGER,
  status TEXT NOT NULL DEFAULT 'review' CHECK(status IN ('collecting','review','approved','paid','cancelled')),
  group_message_id INTEGER,
  order_id TEXT,
  last_activity_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reminder_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_order_drafts_status ON ai_order_drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_order_drafts_customer ON ai_order_drafts(telegram_id, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS ai_weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  report_text TEXT NOT NULL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_ai_reports_sent ON ai_weekly_reports(sent_at DESC);

CREATE TABLE IF NOT EXISTS ai_runtime_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_owner_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered')),
  answer TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TEXT,
  answered_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_owner_questions_status ON ai_owner_questions(status,created_at DESC);
