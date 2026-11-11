-- Persistent owner notifications in the Mini App admin panel.
CREATE TABLE IF NOT EXISTS admin_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON admin_notifications(read_at, created_at DESC);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0018_admin_notifications');
