ALTER TABLE products ADD COLUMN published_at TEXT;
UPDATE products SET published_at=created_at WHERE is_active=1 AND published_at IS NULL;
