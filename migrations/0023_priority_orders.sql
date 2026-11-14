ALTER TABLE orders ADD COLUMN priority_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gift_bundles ADD COLUMN owner_confirmed_at TEXT;
