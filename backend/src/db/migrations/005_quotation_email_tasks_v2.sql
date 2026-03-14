-- ============================================================
-- MIGRATION 005: Quotation Email, Tasks Blocked Status,
--                Activity Timeline v2, Sales Activity Report
-- Date: 2026-03-14
-- Safe: idempotent
-- ============================================================

-- ── Extend deal_activities activity_type to include more events ───────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'deal_activities' AND constraint_name = 'deal_activities_activity_type_check'
  ) THEN
    ALTER TABLE deal_activities DROP CONSTRAINT IF EXISTS deal_activities_activity_type_check;
  END IF;
END $$;

ALTER TABLE deal_activities ADD CONSTRAINT deal_activities_activity_type_check
  CHECK (activity_type IN (
    'call','email','meeting','note','stage_change','rfq_submitted',
    'quotation_uploaded','deal_won','deal_lost','follow_up','other',
    'quotation_sent','quotation_accepted','quotation_rejected',
    'quotation_expired','quotation_duplicated','rfq_created',
    'lead_converted','email_sent'
  ));

-- ── Add email_log table for quotation email tracking ─────────────────────────
CREATE TABLE IF NOT EXISTS quotation_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name VARCHAR(255),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body TEXT,
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent','failed','bounced')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_emails_quotation_id ON quotation_emails(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_emails_deal_id ON quotation_emails(deal_id);

-- ── Add blocked status to tasks ───────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_status_check'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
  END IF;
END $$;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending','in_progress','completed','cancelled','blocked'));

-- ── Add blocked_reason to tasks ───────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- ── Sales activity report view ────────────────────────────────────────────────
CREATE OR REPLACE VIEW sales_activity_report AS
SELECT
  u.id AS user_id,
  u.first_name || ' ' || u.last_name AS user_name,
  u.email AS user_email,
  COALESCE(r.name, 'Unknown') AS user_role,
  -- Leads
  COUNT(DISTINCT l.id) FILTER (WHERE l.created_by = u.id) AS leads_created,
  COUNT(DISTINCT l.id) FILTER (WHERE l.assigned_to = u.id AND l.status = 'contacted') AS leads_contacted,
  -- Deals
  COUNT(DISTINCT d.id) FILTER (WHERE d.assigned_to = u.id) AS deals_total,
  COUNT(DISTINCT d.id) FILTER (WHERE d.assigned_to = u.id AND d.stage = 'rfq') AS deals_rfq,
  COUNT(DISTINCT d.id) FILTER (WHERE d.assigned_to = u.id AND d.stage = 'quotation') AS deals_quoted,
  COUNT(DISTINCT d.id) FILTER (WHERE d.assigned_to = u.id AND d.stage = 'won') AS deals_won,
  COUNT(DISTINCT d.id) FILTER (WHERE d.assigned_to = u.id AND d.stage = 'lost') AS deals_lost,
  -- Activities
  COUNT(DISTINCT da.id) FILTER (WHERE da.user_id = u.id) AS activities_total,
  COUNT(DISTINCT da.id) FILTER (WHERE da.user_id = u.id AND da.activity_type = 'call') AS calls_made,
  COUNT(DISTINCT da.id) FILTER (WHERE da.user_id = u.id AND da.activity_type = 'email') AS emails_sent,
  COUNT(DISTINCT da.id) FILTER (WHERE da.user_id = u.id AND da.activity_type = 'meeting') AS meetings_held
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN leads l ON (l.created_by = u.id OR l.assigned_to = u.id)
LEFT JOIN deals d ON d.assigned_to = u.id
LEFT JOIN deal_activities da ON da.user_id = u.id
WHERE u.is_active = TRUE
GROUP BY u.id, u.first_name, u.last_name, u.email, r.name;

-- ── Add quotation_email_count to quotations ───────────────────────────────────
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS email_sent_count INTEGER DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS last_email_recipient VARCHAR(255);

-- ── Add source_quotation_id for duplicate tracking ────────────────────────────
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS source_quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL;
