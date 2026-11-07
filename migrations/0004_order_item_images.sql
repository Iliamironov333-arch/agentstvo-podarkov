-- Сохраняем изображения каждого товара в заказе для автоматической выдачи после оплаты.
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  image_url TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','sending','sent')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id, id);
