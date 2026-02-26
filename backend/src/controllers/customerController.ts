import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const getCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status, country, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.company_name ILIKE $${params.length} OR c.industry ILIKE $${params.length})`);
    }
    if (status) { params.push(status); conditions.push(`c.status = $${params.length}`); }
    if (country) { params.push(country); conditions.push(`c.country = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) FROM customers c ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT c.*, 
        u.first_name || ' ' || u.last_name as assigned_to_name,
        (SELECT COUNT(*) FROM shipments WHERE customer_id = c.id) as shipment_count,
        (SELECT COUNT(*) FROM opportunities WHERE customer_id = c.id) as opportunity_count,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE customer_id = c.id) as total_revenue
       FROM customers c
       LEFT JOIN users u ON c.assigned_to = u.id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getCustomers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
};

export const getCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT c.*,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        (SELECT JSON_AGG(ct.*) FROM contacts ct WHERE ct.customer_id = c.id) as contacts,
        (SELECT JSON_AGG(s.* ORDER BY s.created_at DESC) FROM shipments s WHERE s.customer_id = c.id LIMIT 10) as recent_shipments,
        (SELECT JSON_AGG(o.* ORDER BY o.created_at DESC) FROM opportunities o WHERE o.customer_id = c.id LIMIT 10) as opportunities,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE customer_id = c.id) as total_revenue,
        (SELECT COALESCE(SUM(outstanding_amount),0) FROM invoices WHERE customer_id = c.id AND status != 'paid') as outstanding_balance
       FROM customers c
       LEFT JOIN users u ON c.assigned_to = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch customer' });
  }
};

export const createCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { companyName, industry, country, city, address, website, taxId, creditLimit, paymentTerms, status, notes, assignedTo } = req.body;

    const result = await query(
      `INSERT INTO customers (company_name, industry, country, city, address, website, tax_id, credit_limit, payment_terms, status, notes, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [companyName, industry, country, city, address, website, taxId, creditLimit || 0, paymentTerms || 30, status || 'prospect', notes, assignedTo || req.user!.id, req.user!.id]
    );

    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES ($1,'customer_created','customer',$2,$3)`,
      [req.user!.id, result.rows[0].id, JSON.stringify(req.body)]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { companyName, industry, country, city, address, website, taxId, creditLimit, paymentTerms, status, notes, assignedTo } = req.body;

    const result = await query(
      `UPDATE customers SET company_name=$1, industry=$2, country=$3, city=$4, address=$5, website=$6,
       tax_id=$7, credit_limit=$8, payment_terms=$9, status=$10, notes=$11, assigned_to=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [companyName, industry, country, city, address, website, taxId, creditLimit, paymentTerms, status, notes, assignedTo, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values) VALUES ($1,'customer_updated','customer',$2,$3)`,
      [req.user!.id, id, JSON.stringify(req.body)]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update customer' });
  }
};

export const deleteCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM customers WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1,'customer_deleted','customer',$2)`,
      [req.user!.id, id]
    );
    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete customer' });
  }
};

export const createContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customerId } = req.params;
    const { firstName, lastName, email, phone, position, isPrimary } = req.body;

    if (isPrimary) {
      await query('UPDATE contacts SET is_primary=false WHERE customer_id=$1', [customerId]);
    }

    const result = await query(
      `INSERT INTO contacts (customer_id, first_name, last_name, email, phone, position, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [customerId, firstName, lastName, email, phone, position, isPrimary || false]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create contact' });
  }
};
