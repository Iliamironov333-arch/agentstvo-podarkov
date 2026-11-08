-- AI management: auditable usage accounting for the owner panel.
-- Configuration itself is stored in app_settings; no API keys are stored here.
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feature TEXT NOT NULL DEFAULT 'support',
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  request_status TEXT NOT NULL DEFAULT 'success',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at
  ON ai_usage_log(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature_created
  ON ai_usage_log(feature, created_at);
