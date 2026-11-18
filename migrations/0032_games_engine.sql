-- Server-authoritative game progress and owner-controlled four-level game configuration.
CREATE TABLE IF NOT EXISTS game_config (
  game_key TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS game_progress (
  telegram_id TEXT NOT NULL,
  game_key TEXT NOT NULL,
  level_index INTEGER NOT NULL DEFAULT 0 CHECK(level_index BETWEEN 0 AND 3),
  stage_index INTEGER NOT NULL DEFAULT 0 CHECK(stage_index BETWEEN 0 AND 3),
  loss_count INTEGER NOT NULL DEFAULT 0 CHECK(loss_count >= 0),
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','playing','lost','completed')),
  reward_json TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(telegram_id,game_key),
  FOREIGN KEY(telegram_id) REFERENCES users(telegram_id)
);
CREATE TABLE IF NOT EXISTS game_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  game_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('continue','answer_correct','answer_wrong')),
  details_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(telegram_id) REFERENCES users(telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_game_events_user ON game_events(telegram_id,created_at DESC);
INSERT OR IGNORE INTO game_config(game_key,config_json,updated_by) VALUES(
 'main',
 '{"enabled":false,"levels":[{"title":"Деревянный","stages":[]},{"title":"Серебряный","stages":[]},{"title":"Золотой","stages":[]},{"title":"Рубиновый","stages":[]}],"active_secret":null}',
 NULL
);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0032_games_engine');
