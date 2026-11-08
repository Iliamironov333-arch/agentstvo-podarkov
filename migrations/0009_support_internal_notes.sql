-- Private owner notes attached to a buyer support conversation.
-- Notes are never sent to the buyer or included in AI conversation context.
CREATE TABLE IF NOT EXISTS support_internal_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  admin_telegram_id TEXT NOT NULL,
  note TEXT NOT NULL CHECK (length(note) BETWEEN 2 AND 2000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_support_internal_notes_user
  ON support_internal_notes(telegram_id, id DESC);
