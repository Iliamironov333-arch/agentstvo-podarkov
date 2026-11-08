-- Управление должностями и индивидуальными разрешениями административной панели.
-- Не назначает модераторов автоматически; владелец делает это из панели.
CREATE TABLE IF NOT EXISTS admin_staff (
  telegram_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner','moderator','client')),
  permissions_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_staff_role_status ON admin_staff(role,status);
