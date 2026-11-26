-- Scheduled delivery time for mass Telegram campaigns (stored as UTC SQLite datetime).
ALTER TABLE campaigns ADD COLUMN scheduled_at TEXT;
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_queue ON campaigns(status, scheduled_at);
