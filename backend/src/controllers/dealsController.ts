import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

type AnyRecord = Record<string, any>;

const STAGE_PROBABILITIES: Record<string, number> = {
  lead: 10, contacted: 25, rfq: 40, quotation: 55, negotiation: 75, won: 100, lost: 0,
};

// Helper: check if user can access a deal
const canAccessDeal = (deal: AnyRecord, user: AuthRequest['user']): boolean => {
  if (!user) return false;
  if (['Admin', 'Finance', 'Operations'].includes(user.role)) return true;
  if (user.role === 'Sales') return deal.assigned_to === user.id || deal.created_by === user.id;
  if (user.role === 'Support') return ['rfq','quotation','negotiation','won'].includes(deal.stage);
  return false;
};

// ─── GET ALL DEALS (pipeline + list) ───────────────────────────────────────
export const getDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { stage, assignedTo, search, page = 1, limit = 100, customerId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    const isAdmin = ['Admin','Finance','Operations'].includes(req.user?.role || '');
    if (!isAdmin) {
      // Sales: own deals only
      params.push(req.user!.id);
      conditions.push(`(d.assigned_to = $${params.length} OR d.created_by = $${params.length})`);
    } else if (assignedTo) {
      params.push(assignedTo);
      conditions.push(`d.assigned_to = $${params.length}`);
    }

    if (stage) { params.push(stage); conditions.push(`d.stage = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`d.customer_id = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(d.title ILIKE $${params.length} OR c.company_name ILIKE $${params.length} OR d.deal_number ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM deals d LEFT JOIN customers c ON d.customer_id = c.id ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT d.*,
        c.company_name as customer_name, c.country as customer_country,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        (SELECT COUNT(*) FROM rfqs r WHERE r.deal_id = d.id) as rfq_count,
        (SELECT COUNT(*) FROM quotations q WHERE q.deal_id = d.id) as quotation_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.deal_id = d.id) as task_count
       FROM deals d
       LEFT JOIN customers c ON d.customer_id = c.id
       LEFT JOIN users u ON d.assigned_to = u.id
       LEFT JOIN users creator ON d.created_by = creator.id
       ${where}
       ORDER BY d.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Build pipeline grouped by stage
    const pipeline: Record<string, AnyRecord[]> = {
      lead: [], contacted: [], rfq: [], quotation: [], negotiation: [], won: [], lost: []
    };
    result.rows.forEach(deal => {
      if (pipeline[deal.stage]) pipeline[deal.stage].push(deal);
    });

    res.json({ success: true, data: result.rows, pipeline, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getDeals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deals' });
  }
};

// ─── GET SINGLE DEAL ────────────────────────────────────────────────────────
export const getDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT d.*,
        c.company_name as customer_name, c.country as customer_country,
        c.email as customer_email, c.phone as customer_phone,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        (SELECT JSON_AGG(a.* ORDER BY a.created_at DESC) FROM deal_activities a WHERE a.deal_id = d.id) as activities,
        (SELECT JSON_AGG(r.* ORDER BY r.created_at DESC) FROM rfqs r WHERE r.deal_id = d.id) as rfqs,
        (SELECT JSON_AGG(q.* ORDER BY q.created_at DESC) FROM quotations q WHERE q.deal_id = d.id) as quotations,
        (SELECT JSON_AGG(t.* ORDER BY t.due_date ASC) FROM tasks t WHERE t.deal_id = d.id AND t.status != 'cancelled') as tasks,
        (SELECT JSON_AGG(doc.* ORDER BY doc.created_at DESC) FROM documents doc WHERE doc.deal_id = d.id) as documents
       FROM deals d
       LEFT JOIN customers c ON d.customer_id = c.id
       LEFT JOIN users u ON d.assigned_to = u.id
       LEFT JOIN users creator ON d.created_by = creator.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Deal not found' });
      return;
    }

    const deal = result.rows[0];
    if (!canAccessDeal(deal, req.user)) {
      res.status(403).json({ success: false, message: 'Access denied to this deal' });
      return;
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    console.error('getDeal error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deal' });
  }
};

// ─── CREATE DEAL ────────────────────────────────────────────────────────────
export const createDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title, customerId, stage = 'lead', value = 0, currency = 'USD', probability,
      expectedCloseDate, serviceType, originCountry, originPort, destinationCountry,
      destinationPort, cargoType, shippingMode, incoterms, notes, assignedTo,
      opsAssignedTo, financeAssignedTo
    } = req.body;

    if (!title) { res.status(400).json({ success: false, message: 'Deal title is required' }); return; }
    if (!customerId) { res.status(400).json({ success: false, message: 'Customer is required' }); return; }

    const prob = probability ?? STAGE_PROBABILITIES[stage as string] ?? 10;
    const assignee = assignedTo || req.user!.id;

    const result = await query(
      `INSERT INTO deals (
        title, customer_id, stage, value, currency, probability,
        expected_close_date, service_type, origin_country, origin_port,
        destination_country, destination_port, cargo_type, shipping_mode,
        incoterms, notes, assigned_to, ops_assigned_to, finance_assigned_to, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [title, customerId, stage, value, currency, prob,
       expectedCloseDate || null, serviceType, originCountry, originPort,
       destinationCountry, destinationPort, cargoType, shippingMode,
       incoterms, notes, assignee, opsAssignedTo || null, financeAssignedTo || null, req.user!.id]
    );

    // Log activity
    await query(
      `INSERT INTO deal_activities (deal_id, user_id, activity_type, description, new_stage)
       VALUES ($1, $2, 'stage_change', $3, $4)`,
      [result.rows[0].id, req.user!.id, `Deal created at stage: ${stage}`, stage]
    );

    // Log audit
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'created', 'deal', $2, $3)`,
      [req.user!.id, result.rows[0].id, JSON.stringify({ label: title, role: req.user!.role, name: `${req.user!.firstName} ${req.user!.lastName}` })]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Deal created successfully' });
  } catch (error) {
    console.error('createDeal error:', error);
    res.status(500).json({ success: false, message: 'Failed to create deal' });
  }
};

// ─── UPDATE DEAL ────────────────────────────────────────────────────────────
export const updateDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM deals WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Deal not found' }); return;
    }
    if (!canAccessDeal(existing.rows[0], req.user)) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }

    const {
      title, customerId, stage, value, currency, probability, expectedCloseDate,
      serviceType, originCountry, originPort, destinationCountry, destinationPort,
      cargoType, shippingMode, incoterms, notes, assignedTo, opsAssignedTo,
      financeAssignedTo, lossReason, actualCloseDate
    } = req.body;

    const oldStage = existing.rows[0].stage;
    const newStage = stage || oldStage;
    const prob = probability ?? (stage ? STAGE_PROBABILITIES[stage] : undefined) ?? existing.rows[0].probability;

    const result = await query(
      `UPDATE deals SET
        title = COALESCE($1, title),
        customer_id = COALESCE($2, customer_id),
        stage = COALESCE($3, stage),
        value = COALESCE($4, value),
        currency = COALESCE($5, currency),
        probability = $6,
        expected_close_date = COALESCE($7, expected_close_date),
        actual_close_date = COALESCE($8, actual_close_date),
        service_type = COALESCE($9, service_type),
        origin_country = COALESCE($10, origin_country),
        origin_port = COALESCE($11, origin_port),
        destination_country = COALESCE($12, destination_country),
        destination_port = COALESCE($13, destination_port),
        cargo_type = COALESCE($14, cargo_type),
        shipping_mode = COALESCE($15, shipping_mode),
        incoterms = COALESCE($16, incoterms),
        notes = COALESCE($17, notes),
        assigned_to = COALESCE($18, assigned_to),
        ops_assigned_to = COALESCE($19, ops_assigned_to),
        finance_assigned_to = COALESCE($20, finance_assigned_to),
        loss_reason = COALESCE($21, loss_reason),
        updated_at = NOW()
       WHERE id = $22 RETURNING *`,
      [title, customerId, stage, value, currency, prob,
       expectedCloseDate || null, actualCloseDate || null,
       serviceType, originCountry, originPort, destinationCountry, destinationPort,
       cargoType, shippingMode, incoterms, notes, assignedTo, opsAssignedTo,
       financeAssignedTo, lossReason, id]
    );

    // Log stage change activity
    if (stage && stage !== oldStage) {
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description, old_stage, new_stage)
         VALUES ($1, $2, 'stage_change', $3, $4, $5)`,
        [id, req.user!.id, `Stage changed from ${oldStage} to ${newStage}`, oldStage, newStage]
      );
    }

    res.json({ success: true, data: result.rows[0], message: 'Deal updated successfully' });
  } catch (error) {
    console.error('updateDeal error:', error);
    res.status(500).json({ success: false, message: 'Failed to update deal' });
  }
};

// ─── UPDATE STAGE (Kanban drag-drop) ────────────────────────────────────────
export const updateDealStage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { stage, lossReason } = req.body;

    if (!stage) { res.status(400).json({ success: false, message: 'Stage is required' }); return; }

    const existing = await query('SELECT * FROM deals WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Deal not found' }); return;
    }
    if (!canAccessDeal(existing.rows[0], req.user)) {
      res.status(403).json({ success: false, message: 'Access denied' }); return;
    }

    const oldStage = existing.rows[0].stage;
    const prob = STAGE_PROBABILITIES[stage] ?? existing.rows[0].probability;
    const actualClose = ['won', 'lost'].includes(stage) ? new Date().toISOString().split('T')[0] : null;

    const result = await query(
      `UPDATE deals SET stage = $1, probability = $2, loss_reason = COALESCE($3, loss_reason),
        actual_close_date = COALESCE($4, actual_close_date), updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [stage, prob, lossReason || null, actualClose, id]
    );

    await query(
      `INSERT INTO deal_activities (deal_id, user_id, activity_type, description, old_stage, new_stage)
       VALUES ($1, $2, 'stage_change', $3, $4, $5)`,
      [id, req.user!.id, `Stage moved: ${oldStage} → ${stage}${lossReason ? '. Reason: ' + lossReason : ''}`, oldStage, stage]
    );

    res.json({ success: true, data: result.rows[0], message: `Deal moved to ${stage}` });
  } catch (error) {
    console.error('updateDealStage error:', error);
    res.status(500).json({ success: false, message: 'Failed to update deal stage' });
  }
};

// ─── DELETE DEAL ────────────────────────────────────────────────────────────
export const deleteDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM deals WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Deal not found' }); return;
    }

    await query('DELETE FROM deals WHERE id = $1', [id]);
    res.json({ success: true, message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('deleteDeal error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete deal' });
  }
};

// ─── ADD ACTIVITY TO DEAL ───────────────────────────────────────────────────
export const addDealActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { activityType, description, outcome, scheduledAt } = req.body;

    if (!description) { res.status(400).json({ success: false, message: 'Description is required' }); return; }

    const result = await query(
      `INSERT INTO deal_activities (deal_id, user_id, activity_type, description, outcome, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, req.user!.id, activityType || 'note', description, outcome, scheduledAt || null]
    );

    // Update deal updated_at
    await query('UPDATE deals SET updated_at = NOW() WHERE id = $1', [id]);

    res.status(201).json({ success: true, data: result.rows[0], message: 'Activity logged' });
  } catch (error) {
    console.error('addDealActivity error:', error);
    res.status(500).json({ success: false, message: 'Failed to add activity' });
  }
};

// ─── GET DEAL ACTIVITIES ────────────────────────────────────────────────────
export const getDealActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email
       FROM deal_activities a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.deal_id = $1
       ORDER BY a.created_at DESC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch activities' });
  }
};

// ─── GET DEALS PIPELINE SUMMARY ─────────────────────────────────────────────
export const getDealsPipeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isAdmin = ['Admin', 'Finance', 'Operations'].includes(req.user?.role || '');
    const userFilter = isAdmin ? '' : `AND (d.assigned_to = '${req.user!.id}' OR d.created_by = '${req.user!.id}')`;

    const result = await query(
      `SELECT stage,
        COUNT(*) as deal_count,
        COALESCE(SUM(value), 0) as total_value,
        COALESCE(AVG(probability), 0) as avg_probability
       FROM deals d
       WHERE TRUE ${userFilter}
       GROUP BY stage
       ORDER BY CASE stage
         WHEN 'lead' THEN 1 WHEN 'contacted' THEN 2 WHEN 'rfq' THEN 3
         WHEN 'quotation' THEN 4 WHEN 'negotiation' THEN 5
         WHEN 'won' THEN 6 WHEN 'lost' THEN 7 END`
    );

    const stagesOrder = ['lead','contacted','rfq','quotation','negotiation','won','lost'];
    const pipeline: AnyRecord = {};
    stagesOrder.forEach(s => { pipeline[s] = { count: 0, value: 0, probability: 0 }; });
    result.rows.forEach(row => {
      pipeline[row.stage] = {
        count: parseInt(row.deal_count),
        value: parseFloat(row.total_value),
        probability: parseFloat(row.avg_probability)
      };
    });

    res.json({ success: true, data: pipeline });
  } catch (error) {
    console.error('getDealsPipeline error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pipeline' });
  }
};
