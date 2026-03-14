-- ============================================================
-- MIGRATION: RFQ & Quotation System Upgrade (v004)
-- Date: 2026-03-11
-- Safe: idempotent with IF NOT EXISTS / DO NOTHING
-- ============================================================

-- ── RFQ enhancements ──────────────────────────────────────────────────────────
-- Value-Added Services (JSON array of selected services)
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS value_added_services JSONB DEFAULT '[]';
-- Cargo nature flags
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS cargo_nature JSONB DEFAULT '{}';
-- UN number for dangerous goods
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS un_number VARCHAR(20);
-- IMO class for dangerous goods
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS imo_class VARCHAR(20);
-- Packaging group
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS packing_group VARCHAR(10);
-- Flash point for dangerous goods
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS flash_point VARCHAR(50);
-- Perishable specifics
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS perishable BOOLEAN DEFAULT FALSE;
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS perishable_type VARCHAR(100);
-- Stack-ability
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT TRUE;
-- Fragile
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS fragile BOOLEAN DEFAULT FALSE;
-- Oversized / OOG
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS oversized BOOLEAN DEFAULT FALSE;
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS dimensions_lwh VARCHAR(100);
-- Second container type (for mixed loads)
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS container_type_2 VARCHAR(50);
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS container_count_2 INTEGER;
-- Preferred operations team member
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS preferred_ops_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
-- Workflow timestamp
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE rfqs ADD COLUMN IF NOT EXISTS ops_notified_at TIMESTAMP WITH TIME ZONE;

-- ── Quotation enhancements ────────────────────────────────────────────────────
-- Explicit quotation date (separate from created_at)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_date DATE DEFAULT CURRENT_DATE;
-- Carrier / Airline name
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS carrier VARCHAR(150);
-- Preferred route notes
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS preferred_route_notes TEXT;
-- Shipment info synced from RFQ
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_origin_country VARCHAR(100);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_origin_port VARCHAR(100);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_destination_country VARCHAR(100);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_destination_port VARCHAR(100);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_mode VARCHAR(50);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_service_type VARCHAR(100);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_incoterms VARCHAR(20);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_cargo_description TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_weight_kg DECIMAL(10,2);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS shipment_volume_cbm DECIMAL(10,2);
-- Client contact info (for PDF)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_contact_name VARCHAR(255);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_contact_email VARCHAR(255);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_contact_phone VARCHAR(100);
-- PDF stored in documents table; store generation flag
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP WITH TIME ZONE;
-- Header info for PDF
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_header TEXT;

-- ── Index additions ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rfqs_customer_id ON rfqs(customer_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_submitted_by ON rfqs(submitted_by);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);

-- ── Sales Workspace: extend deals stage for new pipeline ─────────────────────
-- Keep existing check constraint; extend it in a migration-safe way
DO $$
BEGIN
  -- Drop existing check constraint if it doesn't include new stages
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'deals' AND constraint_name = 'deals_stage_check'
  ) THEN
    ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
  END IF;
END $$;

ALTER TABLE deals ADD CONSTRAINT deals_stage_check
  CHECK (stage IN (
    'lead','contacted','rfq','quotation','negotiation','won','lost',
    -- New unified pipeline stages (aliases)
    'key_person_reached','follow_up','rfq_requested','quoted'
  ));

-- ── View: Sales Workspace unified pipeline ────────────────────────────────────
CREATE OR REPLACE VIEW sales_workspace AS
SELECT
  -- Lead fields
  l.id AS item_id,
  'lead' AS item_type,
  l.company_name AS title,
  l.contact_name,
  l.email,
  l.phone,
  l.source,
  l.status AS lead_status,
  NULL::VARCHAR AS deal_stage,
  NULL::DECIMAL AS deal_value,
  NULL::VARCHAR AS currency,
  l.assigned_to,
  l.created_at,
  l.updated_at,
  NULL::UUID AS customer_id,
  NULL::UUID AS deal_id,
  l.id AS lead_id,
  u.first_name || ' ' || u.last_name AS assigned_to_name,
  NULL::VARCHAR AS customer_name
FROM leads l
LEFT JOIN users u ON l.assigned_to = u.id
WHERE l.status NOT IN ('disqualified')

UNION ALL

SELECT
  -- Deal fields
  d.id AS item_id,
  'deal' AS item_type,
  d.title,
  NULL AS contact_name,
  NULL AS email,
  NULL AS phone,
  NULL AS source,
  NULL AS lead_status,
  d.stage AS deal_stage,
  d.value AS deal_value,
  d.currency,
  d.assigned_to,
  d.created_at,
  d.updated_at,
  d.customer_id,
  d.id AS deal_id,
  d.lead_id,
  u.first_name || ' ' || u.last_name AS assigned_to_name,
  c.company_name AS customer_name
FROM deals d
LEFT JOIN users u ON d.assigned_to = u.id
LEFT JOIN customers c ON d.customer_id = c.id
WHERE d.stage NOT IN ('won', 'lost');

