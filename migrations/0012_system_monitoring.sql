CREATE TABLE IF NOT EXISTS system_error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info','warning','error','critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','resolved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_system_error_log_status_created
  ON system_error_log(status,created_at DESC);
