import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, assignedTo, page = 1, limit = 200 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];
    const role = req.user?.role;

    if (role === 'Sales') {
      params.push(req.user!.id);
      conditions.push(`(l.assigned_to = $${params.length} OR l.created_by = $${params.length})`);
    }
    if (status) { params.push(status); conditions.push(`l.status = $${params.length}`); }
    if (assignedTo) { params.push(assignedTo); conditions.push(`l.assigned_to = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Number(limit), offset);

    const result = await query(
      `SELECT l.*,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        c.first_name || ' ' || c.last_name as created_by_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       LEFT JOIN users c ON l.created_by = c.id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
};

export const getLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT l.*, u.first_name || ' ' || u.last_name as assigned_to_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.id = $1`,
      [id]
    );
    if (result.rows.length === 0) { res.status(404).json({ success: false, message: 'Lead not found' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch lead' });
  }
};

export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Accept both camelCase and snake_case field names from frontend
    const companyName  = req.body.companyName  || req.body.company_name;
    const contactName  = req.body.contactName  || req.body.contact_name;
    const assignedTo   = req.body.assignedTo   || req.body.assigned_to;
    const { email, phone, source, notes } = req.body;

    if (!companyName) {
      res.status(400).json({ success: false, message: 'Company name required' });
      return;
    }
    const result = await query(
      `INSERT INTO leads (company_name, contact_name, email, phone, source, notes, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [companyName, contactName, email, phone, source || 'manual', notes,
       assignedTo || req.user!.id, req.user!.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createLead error:', error);
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
};

export const updateLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Accept both camelCase and snake_case
    const contactName = req.body.contactName || req.body.contact_name;
    const assignedTo  = req.body.assignedTo  || req.body.assigned_to;
    const { status, notes, email, phone } = req.body;
    const result = await query(
      `UPDATE leads SET
        status = COALESCE($1, status),
        notes = COALESCE($2, notes),
        assigned_to = COALESCE($3, assigned_to),
        contact_name = COALESCE($4, contact_name),
        email = COALESCE($5, email),
        phone = COALESCE($6, phone),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [status, notes, assignedTo, contactName, email, phone, id]
    );
    if (result.rows.length === 0) { res.status(404).json({ success: false, message: 'Lead not found' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
};

export const convertLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { dealTitle, customerId } = req.body;
    const lead = await query('SELECT * FROM leads WHERE id = $1', [id]);
    if (lead.rows.length === 0) { res.status(404).json({ success: false, message: 'Lead not found' }); return; }
    const l = lead.rows[0];
    // Create deal
    const deal = await query(
      `INSERT INTO deals (title, customer_id, stage, lead_id, assigned_to, created_by)
       VALUES ($1,$2,'contacted',$3,$4,$5) RETURNING *`,
      [dealTitle || l.company_name, customerId, id, req.user!.id, req.user!.id]
    );
    // Update lead status
    await query(`UPDATE leads SET status = 'qualified', updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true, data: deal.rows[0], message: 'Lead converted to deal' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to convert lead' });
  }
};

export const deleteLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (req.user?.role !== 'Admin') { res.status(403).json({ success: false, message: 'Admin only' }); return; }
    await query('DELETE FROM leads WHERE id = $1', [id]);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
};
