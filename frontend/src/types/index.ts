export interface Customer {
  id: string;
  company_name: string;
  industry?: string;
  country?: string;
  city?: string;
  status: 'active' | 'inactive' | 'prospect';
  assigned_to_name?: string;
  shipment_count?: number;
  opportunity_count?: number;
  total_revenue?: number;
  created_at: string;
}

export interface Opportunity {
  id: string;
  title: string;
  customer_name?: string;
  stage: 'lead' | 'contacted' | 'quotation' | 'negotiation' | 'won' | 'lost';
  value: number;
  probability: number;
  expected_close_date?: string;
  shipping_mode?: string;
  origin_country?: string;
  destination_country?: string;
  assigned_to_name?: string;
  updated_at: string;
}

export interface Shipment {
  id: string;
  reference_number: string;
  customer_name?: string;
  shipping_mode?: string;
  status: string;
  origin_country: string;
  destination_country: string;
  origin_port?: string;
  destination_port?: string;
  carrier?: string;
  eta?: string;
  etd?: string;
  is_delayed: boolean;
  assigned_to_name?: string;
  open_ticket_count?: number;
  milestones?: Milestone[];
  created_at: string;
}

export interface Milestone {
  id: string;
  milestone_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  planned_date?: string;
  actual_date?: string;
  location?: string;
  notes?: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  customer_name?: string;
  shipment_reference?: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'pending_customer' | 'resolved' | 'closed';
  sla_hours?: number;
  sla_breached?: boolean;
  hours_open?: number;
  assigned_to_name?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name?: string;
  shipment_reference?: string;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  issue_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  currency: string;
  created_at: string;
}

export interface DashboardStats {
  shipments: {
    total: number;
    active: number;
    delivered: number;
    delayed: number;
    in_transit: number;
  };
  revenue: {
    total_invoiced: number;
    total_paid: number;
    total_outstanding: number;
    overdue_count: number;
    overdue_amount: number;
  };
  tickets: {
    total: number;
    open_count: number;
    in_progress: number;
    critical: number;
    sla_breached: number;
    avg_resolution_hours: number;
  };
  sales: {
    total_opportunities: number;
    won: number;
    lost: number;
    active: number;
    won_value: number;
    weighted_pipeline: number;
  };
  delayedShipments: Shipment[];
  overdueInvoices: Invoice[];
  recentActivity: ActivityLog[];
}

export interface ActivityLog {
  id: string;
  user_name?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}
