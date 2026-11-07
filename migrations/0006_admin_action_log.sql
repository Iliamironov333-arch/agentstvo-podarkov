-- Admin audit trail. Apply only after reviewing the deployment plan.
CREATE TABLE IF NOT EXISTS admin_action_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_telegram_id TEXT NOT NULL,
  target_telegram_id TEXT,
  action_type TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_target
  ON admin_action_log(target_telegram_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_created
  ON admin_action_log(id DESC);
