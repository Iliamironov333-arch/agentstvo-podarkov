-- Optional product/category scopes for owner-managed promo codes.
-- Apply after 0013_promo_codes.sql.
ALTER TABLE promo_codes ADD COLUMN product_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE promo_codes ADD COLUMN category_ids TEXT NOT NULL DEFAULT '[]';
