-- 0025: one-time gift certificates that credit internal balance points.
CREATE TABLE IF NOT EXISTS gift_certificates (
  code TEXT PRIMARY KEY CHECK(length(code) BETWEEN 8 AND 32),
  points INTEGER NOT NULL CHECK(points BETWEEN 1 AND 1000000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  redeemed_by TEXT,
  redeemed_at TEXT,
  expires_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (redeemed_by) REFERENCES users(telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_gift_certificates_status ON gift_certificates(is_active, redeemed_at, created_at DESC);
CREATE TABLE IF NOT EXISTS gift_certificate_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_gift_certificate_attempts_user ON gift_certificate_attempts(telegram_id, attempted_at DESC);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0025_gift_certificates');
