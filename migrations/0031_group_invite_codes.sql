CREATE TABLE IF NOT EXISTS group_invite_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  code_cipher TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('one_time','reusable')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_group_invite_codes_active
  ON group_invite_codes(deleted_at, mode, used_at);

CREATE TRIGGER IF NOT EXISTS group_invite_codes_limit_active
BEFORE INSERT ON group_invite_codes
WHEN (
  SELECT COUNT(*) FROM group_invite_codes
  WHERE deleted_at IS NULL AND (mode='reusable' OR used_at IS NULL)
) >= 5
BEGIN
  SELECT RAISE(ABORT, 'MAX_ACTIVE_GROUP_INVITES');
END;
