-- Reputation ranks, monthly leaderboard, and auditable point ledger.
CREATE TABLE IF NOT EXISTS reputation_profiles (
  telegram_id TEXT PRIMARY KEY,
  rank_code TEXT NOT NULL DEFAULT 'ordinary'
    CHECK(rank_code IN ('ordinary','regular','vip','god','secret')),
  leaderboard_opt_in INTEGER NOT NULL DEFAULT 1 CHECK(leaderboard_opt_in IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
CREATE TABLE IF NOT EXISTS reputation_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  actor_telegram_id TEXT,
  amount INTEGER NOT NULL CHECK(amount <> 0),
  source TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  leaderboard_eligible INTEGER NOT NULL DEFAULT 1 CHECK(leaderboard_eligible IN (0,1)),
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_reputation_transactions_user_date
  ON reputation_transactions(telegram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_transactions_month
  ON reputation_transactions(created_at, leaderboard_eligible, amount);
CREATE TABLE IF NOT EXISTS reputation_monthly_settlements (
  month_key TEXT PRIMARY KEY,
  first_telegram_id TEXT,
  second_telegram_id TEXT,
  first_points INTEGER NOT NULL DEFAULT 0,
  second_points INTEGER NOT NULL DEFAULT 0,
  rewards_json TEXT NOT NULL DEFAULT '{}',
  settled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reputation_profiles_rank
  ON reputation_profiles(rank_code);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0028_reputation_ranks_leaderboard');
