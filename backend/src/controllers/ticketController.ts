import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const getTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, category, priority, customerId, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    // RBAC: non-Admin users see only tickets assigned to them or created by them
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin) {
      params.push(req.user!.id);
      conditions.push(`(t.assigned_to = $${params.length} OR t.created_by = $${params.length})`);
    }

    if (status) { params.push(status); conditions.push(`t.status = $${params.length}`); }
    if (category) { params.push(category); conditions.push(`t.category = $${params.length}`); }
    if (priority) { params.push(priority); conditions.push(`t.priority = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`t.customer_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM tickets t ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT t.*,
        c.company_name as customer_name,
        s.reference_number as shipment_reference,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600 as hours_open,
        CASE WHEN t.sla_hours > 0 AND EXTRACT(EPOCH FROM (NOW() - t.opened_at))/3600 > t.sla_hours THEN true ELSE false END as sla_breached
       FROM tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN shipments s ON t.shipment_id = s.id
       LEFT JOIN users u ON t.assigned_to = u.id
       ${where}
       ORDER BY
         CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getTickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
};

export const getTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT t.*,
        c.company_name as customer_name,
        s.reference_number as shipment_reference,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        (SELECT JSON_AGG(cm.* ORDER BY cm.created_at ASC) FROM ticket_comments cm WHERE cm.ticket_id = t.id) as comments
       FROM tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN shipments s ON t.shipment_id = s.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
  }
};

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, customerId, shipmentId, category, priority, slaHours, assignedTo } = req.body;

    const ticketNum = `TKT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const result = await query(
      `INSERT INTO tickets (ticket_number, title, description, customer_id, shipment_id, category, priority, sla_hours, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [ticketNum, title, description, customerId, shipmentId, category, priority || 'medium',
       slaHours || 24, assignedTo || req.user!.id, req.user!.id]
    );

    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1,'ticket_created','ticket',$2)`,
      [req.user!.id, result.rows[0].id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create ticket' });
  }
};

export const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, category } = req.body;

    const currentTicket = await query('SELECT status FROM tickets WHERE id=$1', [id]);
    if (currentTicket.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Ticket not found' });
      return;
    }

    const result = await query(
      `UPDATE tickets SET status=$1, priority=$2, assigned_to=$3, category=$4,
       first_response_at = CASE WHEN first_response_at IS NULL AND $1 != 'open' THEN NOW() ELSE first_response_at END,
       resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
       closed_at = CASE WHEN $1 = 'closed' THEN NOW() ELSE closed_at END,
       updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [status, priority, assignedTo, category, id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update ticket' });
  }
};

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content, isInternal } = req.body;

    const result = await query(
      `INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, req.user!.id, content, isInternal || false]
    );

    // Update first_response_at if this is the first comment
    await query(
      `UPDATE tickets SET first_response_at = COALESCE(first_response_at, NOW()), updated_at=NOW() WHERE id=$1`,
      [id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};
