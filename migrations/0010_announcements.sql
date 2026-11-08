-- Owner-managed announcements displayed inside the Mini App.
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 100),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
  link_url TEXT,
  starts_at TEXT,
  ends_at TEXT,
  audience_type TEXT NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all','selected')),
  audience_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_announcements_status_dates
  ON announcements(status, starts_at, ends_at);
