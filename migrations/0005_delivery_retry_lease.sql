-- Позволяет безопасно повторить выдачу, если Worker завершился со статусом sending.
ALTER TABLE order_items ADD COLUMN delivery_started_at TEXT;
