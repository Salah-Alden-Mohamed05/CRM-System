import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

const STAGE_PROBABILITIES: Record<string, number> = {
  lead: 10, contacted: 25, quotation: 50, negotiation: 75, won: 100, lost: 0,
};

export const getOpportunities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { stage, assignedTo, search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (stage) { params.push(stage); conditions.push(`o.stage = $${params.length}`); }
    if (assignedTo) { params.push(assignedTo); conditions.push(`o.assigned_to = $${params.length}`); }
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

    // Group by stage for pipeline view
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
      `UPDATE opportunities SET title=$1, stage=$2, value=$3, probability=$4, expected_close_date=$5,
       service_type=$6, origin_country=$7, destination_country=$8, cargo_type=$9, shipping_mode=$10,
       notes=$11, assigned_to=$12, loss_reason=$13, probability=COALESCE($4, probability),
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
      `UPDATE opportunities SET stage=$1, probability=$2, loss_reason=$3,
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

    // Auto-create shipment if won
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

export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT l.*, u.first_name || ' ' || u.last_name as assigned_to_name
       FROM leads l LEFT JOIN users u ON l.assigned_to = u.id
       ORDER BY l.created_at DESC`
    );
    res.json({ success: true, data: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
};

export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyName, contactName, email, phone, source, notes, assignedTo } = req.body;
    const result = await query(
      `INSERT INTO leads (company_name, contact_name, email, phone, source, notes, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [companyName, contactName, email, phone, source, notes, assignedTo || req.user!.id, req.user!.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
};
