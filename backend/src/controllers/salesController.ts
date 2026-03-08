import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { logActivity, getActivityContext } from '../utils/activityLogger';

const STAGE_PROBABILITIES: Record<string, number> = {
  lead: 10, contacted: 25, rfq: 40, quotation: 55, negotiation: 75, won: 100, lost: 0,
};

// ─── OPPORTUNITIES (legacy) ──────────────────────────────────────────────────
export const getOpportunities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { stage, assignedTo, search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    const isAdmin = ['Admin', 'Finance', 'Operations'].includes(req.user?.role || '');
    if (!isAdmin) {
      params.push(req.user!.id);
      conditions.push(`o.assigned_to = $${params.length}`);
    } else if (assignedTo) {
      params.push(assignedTo);
      conditions.push(`o.assigned_to = $${params.length}`);
    }

    if (stage) { params.push(stage); conditions.push(`o.stage = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(o.title ILIKE $${params.length} OR c.company_name ILIKE $${params.length})`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM opportunities o LEFT JOIN customers c ON o.customer_id = c.id ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT o.*, c.company_name as customer_name, c.country as customer_country,
        u.first_name || ' ' || u.last_name as assigned_to_name
       FROM opportunities o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.assigned_to = u.id
       ${where}
       ORDER BY o.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const pipeline: Record<string, unknown[]> = {
      lead: [], contacted: [], quotation: [], negotiation: [], won: [], lost: []
    };
    result.rows.forEach(opp => {
      if (pipeline[opp.stage]) pipeline[opp.stage].push(opp);
    });

    res.json({ success: true, data: result.rows, pipeline, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getOpportunities error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch opportunities' });
  }
};

export const getOpportunity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT o.*, c.company_name as customer_name, c.country as customer_country,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        (SELECT JSON_AGG(a.* ORDER BY a.created_at DESC) FROM opportunity_activities a WHERE a.opportunity_id = o.id) as activities
       FROM opportunities o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.assigned_to = u.id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Opportunity not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch opportunity' });
  }
};

export const createOpportunity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, customerId, stage = 'lead', value, probability, expectedCloseDate,
      serviceType, originCountry, destinationCountry, cargoType, shippingMode, notes, assignedTo } = req.body;

    const prob = probability ?? STAGE_PROBABILITIES[stage];

    const result = await query(
      `INSERT INTO opportunities (title, customer_id, stage, value, probability, expected_close_date,
       service_type, origin_country, destination_country, cargo_type, shipping_mode, notes, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [title, customerId, stage, value || 0, prob, expectedCloseDate, serviceType, originCountry,
       destinationCountry, cargoType, shippingMode, notes, assignedTo || req.user!.id, req.user!.id]
    );

    await query(
      `INSERT INTO opportunity_activities (opportunity_id, user_id, activity_type, description)
       VALUES ($1,$2,'stage_change','Opportunity created in stage: ' || $3)`,
      [result.rows[0].id, req.user!.id, stage]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create opportunity' });
  }
};

export const updateOpportunity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, stage, value, probability, expectedCloseDate, serviceType,
      originCountry, destinationCountry, cargoType, shippingMode, notes, assignedTo, lossReason } = req.body;

    const prob = probability ?? (stage ? STAGE_PROBABILITIES[stage] : undefined);

    const result = await query(
      `UPDATE opportunities SET title=COALESCE($1,title), stage=COALESCE($2,stage), value=COALESCE($3,value),
       probability=COALESCE($4, probability), expected_close_date=COALESCE($5,expected_close_date),
       service_type=COALESCE($6,service_type), origin_country=COALESCE($7,origin_country),
       destination_country=COALESCE($8,destination_country), cargo_type=COALESCE($9,cargo_type),
       shipping_mode=COALESCE($10,shipping_mode), notes=COALESCE($11,notes),
       assigned_to=COALESCE($12,assigned_to), loss_reason=COALESCE($13,loss_reason),
       actual_close_date = CASE WHEN $2 IN ('won','lost') THEN NOW() ELSE actual_close_date END,
       updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [title, stage, value, prob, expectedCloseDate, serviceType, originCountry,
       destinationCountry, cargoType, shippingMode, notes, assignedTo, lossReason, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Opportunity not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update opportunity' });
  }
};

export const updateStage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { stage, lossReason } = req.body;

    const currentOpp = await query('SELECT stage FROM opportunities WHERE id=$1', [id]);
    if (currentOpp.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Opportunity not found' });
      return;
    }

    const oldStage = currentOpp.rows[0].stage;
    const prob = STAGE_PROBABILITIES[stage];

    const result = await query(
      `UPDATE opportunities SET stage=$1, probability=$2, loss_reason=COALESCE($3,loss_reason),
       actual_close_date = CASE WHEN $1 IN ('won','lost') THEN NOW() ELSE actual_close_date END,
       updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [stage, prob, lossReason, id]
    );

    await query(
      `INSERT INTO opportunity_activities (opportunity_id, user_id, activity_type, description)
       VALUES ($1,$2,'stage_change', $3)`,
      [id, req.user!.id, `Stage changed from ${oldStage} to ${stage}`]
    );

    if (stage === 'won') {
      const opp = result.rows[0];
      const refNum = `SHP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      await query(
        `INSERT INTO shipments (reference_number, customer_id, opportunity_id, shipping_mode, status,
         origin_country, destination_country, created_by)
         VALUES ($1,$2,$3,$4,'booking',$5,$6,$7)`,
        [refNum, opp.customer_id, id, opp.shipping_mode || 'sea',
         opp.origin_country || 'TBD', opp.destination_country || 'TBD', req.user!.id]
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update stage' });
  }
};

export const addActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { activityType, description, outcome, scheduledAt } = req.body;

    const result = await query(
      `INSERT INTO opportunity_activities (opportunity_id, user_id, activity_type, description, outcome, scheduled_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [id, req.user!.id, activityType, description, outcome, scheduledAt]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add activity' });
  }
};

// ─── LEADS MANAGEMENT ────────────────────────────────────────────────────────
export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search, assignedTo, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    const isAdmin = req.user?.role === 'Admin';
    // Sales reps see only their assigned/created leads
    if (!isAdmin) {
      params.push(req.user!.id);
      conditions.push(`(l.assigned_to = $${params.length} OR l.created_by = $${params.length})`);
    } else if (assignedTo) {
      params.push(assignedTo);
      conditions.push(`l.assigned_to = $${params.length}`);
    }

    if (status) { params.push(status); conditions.push(`l.status = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(l.company_name ILIKE $${params.length} OR l.contact_name ILIKE $${params.length} OR l.email ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) FROM leads l ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT l.*,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        u.email as assigned_to_email,
        cr.first_name || ' ' || cr.last_name as created_by_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       LEFT JOIN users cr ON l.created_by = cr.id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Status summary counts
    const summaryResult = await query(
      `SELECT status, COUNT(*) as count FROM leads l
       ${where.replace(/LIMIT.*OFFSET.*$/, '')}
       GROUP BY status`,
      params.slice(0, -2)
    );

    const statusSummary: Record<string, number> = {};
    summaryResult.rows.forEach(r => { statusSummary[r.status] = parseInt(r.count); });

    res.json({ success: true, data: result.rows, total, page: Number(page), limit: Number(limit), statusSummary });
  } catch (error) {
    console.error('getLeads error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
};

export const getLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT l.*,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        cr.first_name || ' ' || cr.last_name as created_by_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       LEFT JOIN users cr ON l.created_by = cr.id
       WHERE l.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }
    const lead = result.rows[0];
    // Sales can only see own leads
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && lead.assigned_to !== req.user!.id && lead.created_by !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch lead' });
  }
};

export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyName, contactName, email, phone, source, notes, assignedTo, status = 'new' } = req.body;
    if (!companyName) {
      res.status(400).json({ success: false, message: 'Company name is required' });
      return;
    }

    // Sales reps can only assign to themselves unless admin
    const isAdmin = req.user?.role === 'Admin';
    const assignee = isAdmin ? (assignedTo || req.user!.id) : req.user!.id;

    const result = await query(
      `INSERT INTO leads (company_name, contact_name, email, phone, source, notes, status, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [companyName, contactName, email, phone, source, notes, status, assignee, req.user!.id]
    );

    const ctx = getActivityContext(req);
    await logActivity({
      ...ctx,
      action: 'lead_created',
      entityType: 'lead',
      entityId: result.rows[0].id,
      entityLabel: companyName,
      description: `Lead created: ${companyName}${assignee !== req.user!.id ? ` (assigned to another rep)` : ''}`,
      newValues: { companyName, contactName, email, source, status, assignedTo: assignee },
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
};

export const updateLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { companyName, contactName, email, phone, source, notes, status, assignedTo } = req.body;

    // Check ownership
    const existing = await query('SELECT * FROM leads WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }

    const lead = existing.rows[0];
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && lead.assigned_to !== req.user!.id && lead.created_by !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Access denied: not your lead' });
      return;
    }

    // Only admin can reassign leads
    const newAssignee = isAdmin ? (assignedTo || lead.assigned_to) : lead.assigned_to;

    const result = await query(
      `UPDATE leads SET
        company_name = COALESCE($1, company_name),
        contact_name = COALESCE($2, contact_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        source = COALESCE($5, source),
        notes = COALESCE($6, notes),
        status = COALESCE($7, status),
        assigned_to = $8,
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [companyName, contactName, email, phone, source, notes, status, newAssignee, id]
    );

    const ctx = getActivityContext(req);
    await logActivity({
      ...ctx,
      action: 'lead_updated',
      entityType: 'lead',
      entityId: id,
      entityLabel: result.rows[0].company_name,
      description: `Lead updated: ${result.rows[0].company_name}. Status: ${status || lead.status}`,
      oldValues: { status: lead.status, assignedTo: lead.assigned_to },
      newValues: { status: status || lead.status, assignedTo: newAssignee },
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
};

export const deleteLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Only admin can delete leads
    if (req.user?.role !== 'Admin') {
      res.status(403).json({ success: false, message: 'Only admins can delete leads' });
      return;
    }
    const result = await query('DELETE FROM leads WHERE id = $1 RETURNING company_name', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }
    const ctx = getActivityContext(req);
    await logActivity({
      ...ctx,
      action: 'lead_deleted',
      entityType: 'lead',
      entityId: id,
      entityLabel: result.rows[0].company_name,
      description: `Lead deleted: ${result.rows[0].company_name}`,
    });
    res.json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
};

/**
 * Convert a qualified lead to a deal + auto-create/link customer
 * POST /sales/leads/:id/convert
 */
export const convertLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      dealTitle, dealValue, expectedCloseDate, shippingMode,
      originCountry, destinationCountry, serviceType, notes,
      // Optional: existing customer to link, otherwise create new
      existingCustomerId
    } = req.body;

    // Fetch the lead
    const leadResult = await query('SELECT * FROM leads WHERE id = $1', [id]);
    if (leadResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }

    const lead = leadResult.rows[0];

    // Verify qualified status or admin
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin && lead.assigned_to !== req.user!.id && lead.created_by !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Access denied: not your lead' });
      return;
    }

    // Step 1: Find or create the customer
    let customerId = existingCustomerId;
    if (!customerId) {
      // Check if customer with same company already exists
      const existingCustomer = await query(
        'SELECT id FROM customers WHERE company_name ILIKE $1 LIMIT 1',
        [lead.company_name]
      );

      if (existingCustomer.rows.length > 0) {
        customerId = existingCustomer.rows[0].id;
      } else {
        // Create new customer from lead data
        const customerResult = await query(
          `INSERT INTO customers (
            company_name, email, phone, status,
            sales_owner_id, assigned_to, created_by, notes
          ) VALUES ($1,$2,$3,'prospect',$4,$5,$6,$7) RETURNING id`,
          [
            lead.company_name,
            lead.email || null,
            lead.phone || null,
            lead.assigned_to,  // sales_owner_id
            lead.assigned_to,  // assigned_to
            req.user!.id,
            `Converted from lead. Contact: ${lead.contact_name || 'N/A'}`
          ]
        );
        customerId = customerResult.rows[0].id;
      }
    }

    // Step 2: Create the deal linked to lead and customer
    const title = dealTitle || `Deal - ${lead.company_name}`;
    const assignee = lead.assigned_to || req.user!.id;
    const prob = STAGE_PROBABILITIES['rfq'];

    const dealResult = await query(
      `INSERT INTO deals (
        title, customer_id, lead_id, stage, value, probability,
        expected_close_date, shipping_mode, origin_country, destination_country,
        service_type, notes, assigned_to, created_by
      ) VALUES ($1,$2,$3,'rfq',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        title, customerId, id, dealValue || 0, prob,
        expectedCloseDate || null,
        shippingMode || null,
        originCountry || null,
        destinationCountry || null,
        serviceType || null,
        notes || lead.notes,
        assignee, req.user!.id
      ]
    );

    const deal = dealResult.rows[0];

    // Step 3: Mark lead as converted
    await query(
      `UPDATE leads SET
        status = 'qualified',
        converted_to_customer = $1,
        converted_at = NOW(),
        updated_at = NOW()
       WHERE id = $2`,
      [customerId, id]
    );

    // Step 4: Log deal creation activity
    await query(
      `INSERT INTO deal_activities (deal_id, user_id, activity_type, description, new_stage)
       VALUES ($1, $2, 'stage_change', $3, 'rfq')`,
      [deal.id, req.user!.id, `Deal created from lead: ${lead.company_name}`]
    );

    // Step 5: Activity log
    const ctx = getActivityContext(req);
    await logActivity({
      ...ctx,
      action: 'lead_converted',
      entityType: 'lead',
      entityId: id,
      entityLabel: lead.company_name,
      description: `Lead converted to deal: ${title}`,
      newValues: { dealId: deal.id, customerId, dealTitle: title },
    });

    res.status(201).json({
      success: true,
      data: {
        deal,
        customerId,
        leadId: id,
        message: `Lead converted to deal successfully`
      },
      message: 'Lead converted to deal successfully'
    });
  } catch (error) {
    console.error('convertLead error:', error);
    res.status(500).json({ success: false, message: 'Failed to convert lead' });
  }
};

// ─── SALES PERSONAL STATS (for sales rep dashboard) ─────────────────────────
export const getSalesPersonalStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { period = '30' } = req.query;
    const days = parseInt(period as string) || 30;

    const [dealStats, leadStats, taskStats, customerStats, recentDeals, recentActivities] = await Promise.all([
      // Personal deal statistics
      query(`
        SELECT
          COUNT(*) FILTER (WHERE stage NOT IN ('won','lost')) as active_deals,
          COUNT(*) FILTER (WHERE stage = 'won' AND updated_at >= NOW() - INTERVAL '${days} days') as deals_won,
          COUNT(*) FILTER (WHERE stage = 'lost' AND updated_at >= NOW() - INTERVAL '${days} days') as deals_lost,
          COALESCE(SUM(value) FILTER (WHERE stage = 'won' AND updated_at >= NOW() - INTERVAL '${days} days'), 0) as revenue_won,
          COALESCE(SUM(value * probability / 100) FILTER (WHERE stage NOT IN ('won','lost')), 0) as pipeline_weighted,
          COALESCE(SUM(value) FILTER (WHERE stage NOT IN ('won','lost')), 0) as pipeline_value
        FROM deals
        WHERE assigned_to = $1 OR created_by = $1
      `, [userId]),

      // Lead statistics
      query(`
        SELECT
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE status = 'new') as new_leads,
          COUNT(*) FILTER (WHERE status = 'contacted') as contacted_leads,
          COUNT(*) FILTER (WHERE status = 'qualified') as qualified_leads,
          COUNT(*) FILTER (WHERE converted_at >= NOW() - INTERVAL '${days} days') as converted_leads
        FROM leads
        WHERE assigned_to = $1 OR created_by = $1
      `, [userId]),

      // Task statistics
      query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
          COUNT(*) FILTER (WHERE status = 'completed' AND updated_at >= NOW() - INTERVAL '${days} days') as completed_tasks,
          COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled') AND due_date < NOW()) as overdue_tasks
        FROM tasks
        WHERE user_id = $1 OR assigned_to = $1
      `, [userId]),

      // Customer statistics
      query(`
        SELECT COUNT(*) as my_customers
        FROM customers
        WHERE sales_owner_id = $1 OR assigned_to = $1 OR created_by = $1
      `, [userId]),

      // Recent deals
      query(`
        SELECT d.id, d.deal_number, d.title, d.stage, d.value, d.currency,
          d.probability, d.expected_close_date, d.updated_at,
          c.company_name as customer_name
        FROM deals d
        LEFT JOIN customers c ON d.customer_id = c.id
        WHERE (d.assigned_to = $1 OR d.created_by = $1)
          AND d.stage NOT IN ('won','lost')
        ORDER BY d.updated_at DESC
        LIMIT 5
      `, [userId]),

      // Recent activities
      query(`
        SELECT al.*, u.first_name || ' ' || u.last_name as user_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.user_id = $1
        ORDER BY al.created_at DESC
        LIMIT 10
      `, [userId]),
    ]);

    res.json({
      success: true,
      data: {
        deals: dealStats.rows[0],
        leads: leadStats.rows[0],
        tasks: taskStats.rows[0],
        customers: customerStats.rows[0],
        recentDeals: recentDeals.rows,
        recentActivities: recentActivities.rows,
        period: days,
      }
    });
  } catch (error) {
    console.error('getSalesPersonalStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch personal stats' });
  }
};
