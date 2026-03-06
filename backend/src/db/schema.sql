-- ============================================================
-- LOGISTICS CRM PROFESSIONAL v8 - COMPLETE SCHEMA
-- Single-company | RBAC | Deals→RFQ→Quotation→Shipment flow
-- Safe to run multiple times (idempotent)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROLES & USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_lower VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS & CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    country VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    website VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    tax_id VARCHAR(100),
    credit_limit DECIMAL(15,2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 30,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','inactive','prospect')),
    notes TEXT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    position VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- DEALS (Enhanced Sales Pipeline - replaces opportunities)
-- Stages: lead → contacted → rfq → quotation → negotiation → won → lost
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_number VARCHAR(50) UNIQUE,
    title VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    stage VARCHAR(50) DEFAULT 'lead' CHECK (stage IN (
        'lead','contacted','rfq','quotation','negotiation','won','lost'
    )),
    value DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    probability INTEGER DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
    expected_close_date DATE,
    actual_close_date DATE,
    -- Logistics specifics
    service_type VARCHAR(100),    -- FCL, LCL, Air, Land
    origin_country VARCHAR(100),
    origin_port VARCHAR(100),
    destination_country VARCHAR(100),
    destination_port VARCHAR(100),
    cargo_type VARCHAR(100),
    shipping_mode VARCHAR(50) CHECK (shipping_mode IN ('air','sea','road','rail','multimodal')),
    incoterms VARCHAR(20),
    -- Ownership & tracking
    loss_reason TEXT,
    notes TEXT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Finance/Ops visibility: after 'rfq' stage, Ops+Finance can access
    ops_assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    finance_assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) CHECK (activity_type IN (
        'call','email','meeting','note','stage_change','rfq_submitted',
        'quotation_uploaded','deal_won','deal_lost','follow_up','other'
    )),
    description TEXT NOT NULL,
    outcome TEXT,
    old_stage VARCHAR(50),
    new_stage VARCHAR(50),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Keep opportunities as alias/legacy (map to deals internally)
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    lead_id UUID,
    stage VARCHAR(50) DEFAULT 'lead' CHECK (stage IN ('lead','contacted','quotation','negotiation','won','lost')),
    value DECIMAL(15,2) DEFAULT 0,
    probability INTEGER DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
    expected_close_date DATE,
    actual_close_date DATE,
    service_type VARCHAR(100),
    origin_country VARCHAR(100),
    destination_country VARCHAR(100),
    cargo_type VARCHAR(100),
    shipping_mode VARCHAR(50),
    notes TEXT,
    loss_reason TEXT,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunity_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) CHECK (activity_type IN ('call','email','meeting','note','stage_change')),
    description TEXT NOT NULL,
    outcome TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- RFQ - Request For Quotation
-- ============================================================
CREATE TABLE IF NOT EXISTS rfqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfq_number VARCHAR(50) UNIQUE,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending','sent_to_ops','pricing','quoted','approved','rejected'
    )),
    -- Logistics fields
    origin_country VARCHAR(100),
    origin_port VARCHAR(100),
    origin_address TEXT,
    destination_country VARCHAR(100),
    destination_port VARCHAR(100),
    destination_address TEXT,
    shipping_mode VARCHAR(50) CHECK (shipping_mode IN ('air','sea','road','rail','multimodal')),
    service_type VARCHAR(100),     -- FCL, LCL, Bulk, etc.
    incoterms VARCHAR(20),
    cargo_type VARCHAR(100),
    cargo_description TEXT,
    -- Dimensions
    weight_kg DECIMAL(10,2),
    volume_cbm DECIMAL(10,2),
    quantity INTEGER,
    unit_type VARCHAR(50),         -- pallets, boxes, containers
    container_type VARCHAR(50),    -- 20GP, 40GP, 40HC, etc.
    container_count INTEGER,
    -- Requirements
    hazardous BOOLEAN DEFAULT FALSE,
    hazmat_class VARCHAR(50),
    temperature_controlled BOOLEAN DEFAULT FALSE,
    temp_range VARCHAR(50),
    insurance_required BOOLEAN DEFAULT FALSE,
    customs_clearance_required BOOLEAN DEFAULT FALSE,
    -- Timeline
    cargo_ready_date DATE,
    required_delivery_date DATE,
    -- Custom fields (JSON for extensibility)
    custom_fields JSONB DEFAULT '{}',
    special_instructions TEXT,
    -- Workflow
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,  -- Ops/Finance
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- QUOTATIONS (Finance/Ops builds the price)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_number VARCHAR(50) UNIQUE,
    rfq_id UUID REFERENCES rfqs(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft','sent','accepted','rejected','expired','revised'
    )),
    -- Validity
    valid_until DATE,
    currency VARCHAR(10) DEFAULT 'USD',
    -- Charges breakdown
    origin_charges DECIMAL(15,2) DEFAULT 0,
    freight_cost DECIMAL(15,2) DEFAULT 0,
    destination_charges DECIMAL(15,2) DEFAULT 0,
    customs_clearance DECIMAL(15,2) DEFAULT 0,
    insurance DECIMAL(15,2) DEFAULT 0,
    other_charges DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    -- PDF
    pdf_url TEXT,
    -- Terms
    transit_time_days INTEGER,
    payment_terms TEXT,
    notes TEXT,
    terms_conditions TEXT,
    -- Workflow
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,  -- 'origin','freight','destination','customs','insurance','other'
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit VARCHAR(50),
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SHIPMENTS & MILESTONES (Enhanced)
-- ============================================================
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    -- Mode & status
    shipping_mode VARCHAR(50) CHECK (shipping_mode IN ('air','sea','road','rail','multimodal')),
    service_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'booking' CHECK (status IN (
        'booking','pickup','customs_export','departed',
        'in_transit','customs_import','arrived','delivered','cancelled'
    )),
    -- Route
    origin_country VARCHAR(100) NOT NULL,
    origin_port VARCHAR(100),
    origin_address TEXT,
    destination_country VARCHAR(100) NOT NULL,
    destination_port VARCHAR(100),
    destination_address TEXT,
    -- Cargo
    cargo_description TEXT,
    weight_kg DECIMAL(10,2),
    volume_cbm DECIMAL(10,2),
    cargo_units INTEGER,
    container_type VARCHAR(50),
    container_count INTEGER,
    container_number VARCHAR(100),
    -- Docs
    bl_number VARCHAR(100),
    awb_number VARCHAR(100),
    mawb_number VARCHAR(100),
    -- Carrier
    carrier VARCHAR(100),
    vessel_name VARCHAR(100),
    voyage_number VARCHAR(100),
    flight_number VARCHAR(100),
    tracking_number VARCHAR(100),
    -- Dates
    eta DATE,
    etd DATE,
    atd DATE,
    ata DATE,
    -- Flags
    is_delayed BOOLEAN DEFAULT FALSE,
    delay_reason TEXT,
    incoterms VARCHAR(20),
    -- People
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    milestone_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','delayed','cancelled')),
    planned_date TIMESTAMP WITH TIME ZONE,
    actual_date TIMESTAMP WITH TIME ZONE,
    location VARCHAR(255),
    notes TEXT,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS (Universal - attached to any entity)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Entity link (one of these will be set)
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    rfq_id UUID REFERENCES rfqs(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    task_id UUID,  -- FK added below after tasks table
    -- File info
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_path TEXT,
    file_type VARCHAR(50),   -- 'pdf','image','xlsx','docx', etc.
    file_size INTEGER,       -- bytes
    mime_type VARCHAR(100),
    -- Category
    document_category VARCHAR(100) CHECK (document_category IN (
        'quotation','contract','invoice','bill_of_lading',
        'customs','packing_list','insurance','certificate',
        'purchase_order','rfq','other'
    )),
    description TEXT,
    -- Access
    is_internal BOOLEAN DEFAULT FALSE,  -- internal only vs shareable
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TASKS (Enhanced with checklist + progress)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Ownership
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,  -- can assign to others (admin)
    -- Links
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    -- Type & content
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN (
        'call','email','meeting','follow_up','demo','proposal',
        'rfq_preparation','quotation_review','shipment_booking',
        'document_collection','customs_filing','delivery','other'
    )),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    required_actions TEXT,   -- what needs to be done
    outcome TEXT,
    notes TEXT,
    -- Status & priority
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    -- Progress (computed from checklist)
    progress_pct INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    -- Dates
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK for documents.task_id now that tasks table exists
ALTER TABLE documents ADD CONSTRAINT fk_documents_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE documents ALTER COLUMN task_id TYPE UUID;

-- Subtasks / checklist items
CREATE TABLE IF NOT EXISTS task_checklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    is_done BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task attachments (via documents table) - helper view
-- (documents.task_id links here)

-- ============================================================
-- SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    category VARCHAR(100) CHECK (category IN ('delay','damage','billing','documentation','customs','other')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open','in_progress','pending_customer','resolved','closed')),
    sla_hours INTEGER DEFAULT 24,
    sla_breach BOOLEAN DEFAULT FALSE,
    sla_breach_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- FINANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    outstanding_amount DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(100),
    reference_number VARCHAR(255),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    cost_type VARCHAR(100) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    vendor VARCHAR(255),
    cost_date DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY LOGS (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    user_role VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    entity_label VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SECURITY TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    result VARCHAR(50) NOT NULL CHECK (result IN (
        'success','wrong_password','user_not_found','account_locked','account_inactive'
    )),
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    refresh_token VARCHAR(512) UNIQUE NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    is_trusted BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token VARCHAR(512) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en','ar')),
    timezone VARCHAR(100) DEFAULT 'UTC',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- IDEMPOTENT COLUMN ADDITIONS
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_lower VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS opportunity_id UUID;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,2);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS volume_cbm DECIMAL(10,2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_breach_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subject VARCHAR(255);

UPDATE users SET email_lower = LOWER(email) WHERE email_lower IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(email_lower);

CREATE OR REPLACE FUNCTION normalize_user_email()
RETURNS TRIGGER AS $$
BEGIN NEW.email_lower = LOWER(NEW.email); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_user_email ON users;
CREATE TRIGGER trg_normalize_user_email
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION normalize_user_email();

-- Auto-update progress_pct on task_checklist change
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_items INTEGER;
    done_items INTEGER;
    pct INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_done = TRUE)
    INTO total_items, done_items
    FROM task_checklist
    WHERE task_id = COALESCE(NEW.task_id, OLD.task_id);

    IF total_items = 0 THEN pct := 0;
    ELSE pct := ROUND((done_items::DECIMAL / total_items::DECIMAL) * 100);
    END IF;

    UPDATE tasks SET progress_pct = pct,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.task_id, OLD.task_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_checklist_progress ON task_checklist;
CREATE TRIGGER trg_task_checklist_progress
    AFTER INSERT OR UPDATE OR DELETE ON task_checklist
    FOR EACH ROW EXECUTE FUNCTION update_task_progress();

-- Auto-generate deal numbers
CREATE OR REPLACE FUNCTION generate_deal_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deal_number IS NULL THEN
        NEW.deal_number := 'DEAL-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
            LPAD(NEXTVAL('deal_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS deal_number_seq START 1;
DROP TRIGGER IF EXISTS trg_deal_number ON deals;
CREATE TRIGGER trg_deal_number
    BEFORE INSERT ON deals
    FOR EACH ROW EXECUTE FUNCTION generate_deal_number();

-- Auto-generate RFQ numbers
CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rfq_number IS NULL THEN
        NEW.rfq_number := 'RFQ-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
            LPAD(NEXTVAL('rfq_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS rfq_number_seq START 1;
DROP TRIGGER IF EXISTS trg_rfq_number ON rfqs;
CREATE TRIGGER trg_rfq_number
    BEFORE INSERT ON rfqs
    FOR EACH ROW EXECUTE FUNCTION generate_rfq_number();

-- Auto-generate Quotation numbers
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quotation_number IS NULL THEN
        NEW.quotation_number := 'QUO-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
            LPAD(NEXTVAL('quotation_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 1;
DROP TRIGGER IF EXISTS trg_quotation_number ON quotations;
CREATE TRIGGER trg_quotation_number
    BEFORE INSERT ON quotations
    FOR EACH ROW EXECUTE FUNCTION generate_quotation_number();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON customers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_deal_id ON rfqs(deal_id);
CREATE INDEX IF NOT EXISTS idx_rfqs_status ON rfqs(status);
CREATE INDEX IF NOT EXISTS idx_quotations_deal_id ON quotations(deal_id);
CREATE INDEX IF NOT EXISTS idx_quotations_rfq_id ON quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_shipments_customer_id ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_deal_id ON shipments(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_deal_id ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_shipment_id ON documents(shipment_id);
CREATE INDEX IF NOT EXISTS idx_documents_task_id ON documents(task_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_checklist_task_id ON task_checklist(task_id);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_deal_id ON invoices(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_customer_id ON opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned_to ON opportunities(assigned_to);
