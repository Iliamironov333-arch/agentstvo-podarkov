ALTER TABLE announcements ADD COLUMN emoji TEXT NOT NULL DEFAULT '📢';
ALTER TABLE announcements ADD COLUMN background TEXT NOT NULL DEFAULT 'gold';
ALTER TABLE announcements ADD COLUMN image_url TEXT;
ALTER TABLE announcements ADD COLUMN button_text TEXT;
ALTER TABLE announcements ADD COLUMN placement TEXT NOT NULL DEFAULT 'home' CHECK(placement IN ('home','shop','both'));
ALTER TABLE announcements ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE announcements ADD COLUMN slide_type TEXT NOT NULL DEFAULT 'ad' CHECK(slide_type IN ('ad','poll'));
ALTER TABLE announcements ADD COLUMN poll_options_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE announcements ADD COLUMN auto_advance_enabled INTEGER NOT NULL DEFAULT 0 CHECK(auto_advance_enabled IN (0,1));
ALTER TABLE announcements ADD COLUMN auto_advance_seconds INTEGER NOT NULL DEFAULT 5 CHECK(auto_advance_seconds BETWEEN 2 AND 60);
ALTER TABLE announcements ADD COLUMN manual_swipe_enabled INTEGER NOT NULL DEFAULT 1 CHECK(manual_swipe_enabled IN (0,1));
CREATE TABLE IF NOT EXISTS announcement_votes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 announcement_id INTEGER NOT NULL,
 telegram_id TEXT NOT NULL,
 option_index INTEGER NOT NULL CHECK(option_index >= 0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(announcement_id,telegram_id),
 FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
 FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
CREATE INDEX IF NOT EXISTS idx_announcement_votes_announcement ON announcement_votes(announcement_id);