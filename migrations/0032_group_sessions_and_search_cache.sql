CREATE TABLE IF NOT EXISTS group_invite_sessions (
  id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (invite_id) REFERENCES group_invite_codes(id)
);

CREATE INDEX IF NOT EXISTS idx_group_invite_sessions_user
  ON group_invite_sessions(telegram_id, expires_at, revoked_at);

CREATE INDEX IF NOT EXISTS idx_group_invite_sessions_invite
  ON group_invite_sessions(invite_id, expires_at, revoked_at);

CREATE TABLE IF NOT EXISTS catalog_search_cache (
  query_hash TEXT PRIMARY KEY,
  product_ids TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catalog_search_cache_expiry
  ON catalog_search_cache(expires_at);

INSERT OR IGNORE INTO schema_migrations(version) VALUES('0032_group_sessions_and_search_cache');
