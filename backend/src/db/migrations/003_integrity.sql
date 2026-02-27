-- ============================================================
-- MIGRATION: Enforce Data Integrity Constraints
-- Version: 003
-- Date: 2026-02-27
-- ============================================================

-- ── Ensure unique email constraint on users ──────────────────
-- We use email_lower for case-insensitive uniqueness
-- This migration ensures the index exists and unique constraint is enforced

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique_lower
    ON users (LOWER(email));

-- ── Ensure roles table has a CHECK constraint ─────────────────
-- Add default roles if missing
INSERT INTO roles (id, name, description, permissions) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Admin',      'Full system access',              '["*"]'),
    ('a0000000-0000-0000-0000-000000000002', 'Sales',      'Sales and CRM access',            '["customers","opportunities","leads"]'),
    ('a0000000-0000-0000-0000-000000000003', 'Operations', 'Shipment management access',      '["shipments","milestones"]'),
    ('a0000000-0000-0000-0000-000000000004', 'Support',    'Support ticket access',           '["tickets","customers:read"]'),
    ('a0000000-0000-0000-0000-000000000005', 'Finance',    'Financial records access',        '["invoices","payments","costs"]')
ON CONFLICT (id) DO NOTHING;

-- ── Ensure admin user exists ──────────────────────────────────
-- Password: Admin@1234 (bcrypt $2a$12$...)
INSERT INTO users (id, email, password_hash, first_name, last_name, role_id, is_active, email_lower)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'admin@logisticscrm.com',
    '$2a$12$EpqW5CKiq8w1rSXEAEHxAOPMpGWTAmqrQBOgbHf6CWPrpGQPcq5tS',
    'System',
    'Admin',
    'a0000000-0000-0000-0000-000000000001',
    TRUE,
    'admin@logisticscrm.com'
)
ON CONFLICT (id) DO NOTHING;

-- ── Ensure user_preferences exist for all users ──────────────
INSERT INTO user_preferences (user_id, language, timezone)
SELECT id, 'en', 'UTC' FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ── Add missing index on users.is_active ─────────────────────
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ── Add missing index on activity_logs.user_id ───────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

-- ── Add missing index on login_attempts ──────────────────────
CREATE INDEX IF NOT EXISTS idx_login_attempts_result ON login_attempts(result);

-- ── Add constraint: password_hash cannot be empty ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_password_not_empty'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_password_not_empty CHECK (LENGTH(password_hash) > 0);
  END IF;
END;
$$;

-- Done
SELECT 'Migration 003 completed' AS status;
