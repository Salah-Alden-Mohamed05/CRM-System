import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { logActivity, getActivityContext } from '../utils/activityLogger';

export const getCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, status, country, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    // RBAC: Sales sees only customers they own/created; Admin/Finance/Ops see all
    const isAdmin = ['Admin', 'Finance', 'Operations'].includes(req.user?.role || '');
    if (!isAdmin) {
      params.push(req.user!.id);
      conditions.push(`(c.sales_owner_id = $${params.length} OR c.assigned_to = $${params.length} OR c.created_by = $${params.length})`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.company_name ILIKE $${params.length} OR c.industry ILIKE $${params.length} OR c.email ILIKE $${params.length})`);
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
        so.first_name || ' ' || so.last_name as sales_owner_name,
        (SELECT COUNT(*) FROM shipments WHERE customer_id = c.id) as shipment_count,
        (SELECT COUNT(*) FROM deals WHERE customer_id = c.id) as deal_count,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE customer_id = c.id) as total_revenue
       FROM customers c
       LEFT JOIN users u ON c.assigned_to = u.id
       LEFT JOIN users so ON c.sales_owner_id = so.id
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
    const isAdmin = ['Admin', 'Finance', 'Operations'].includes(req.user?.role || '');

    let sql = `SELECT c.*,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        so.first_name || ' ' || so.last_name as sales_owner_name,
        (SELECT JSON_AGG(ct.*) FROM contacts ct WHERE ct.customer_id = c.id) as contacts,
        (SELECT JSON_AGG(d.* ORDER BY d.created_at DESC) FROM deals d WHERE d.customer_id = c.id LIMIT 10) as deals,
        (SELECT JSON_AGG(s.* ORDER BY s.created_at DESC) FROM shipments s WHERE s.customer_id = c.id LIMIT 10) as recent_shipments,
        (SELECT JSON_AGG(doc.* ORDER BY doc.created_at DESC) FROM documents doc WHERE doc.customer_id = c.id LIMIT 20) as documents,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE customer_id = c.id) as total_revenue,
        (SELECT COALESCE(SUM(outstanding_amount),0) FROM invoices WHERE customer_id = c.id AND status != 'paid') as outstanding_balance
       FROM customers c
       LEFT JOIN users u ON c.assigned_to = u.id
       LEFT JOIN users so ON c.sales_owner_id = so.id
       WHERE c.id = $1`;

    const queryParams: unknown[] = [id];
    if (!isAdmin) {
      queryParams.push(req.user!.id);
      sql += ` AND (c.sales_owner_id = $2 OR c.assigned_to = $2 OR c.created_by = $2)`;
    }

    const result = await query(sql, queryParams);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found or access denied' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch customer' });
  }
};

export const createCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      companyName, industry, country, city, address, website,
      taxId, creditLimit, paymentTerms, status, notes, assignedTo,
      email, phone
    } = req.body;

    if (!companyName) {
      res.status(400).json({ success: false, message: 'Company name is required' });
      return;
    }

    const isAdmin = req.user?.role === 'Admin';
    const salesOwner = isAdmin ? (assignedTo || req.user!.id) : req.user!.id;

    const result = await query(
      `INSERT INTO customers (
        company_name, industry, country, city, address, website,
        tax_id, credit_limit, payment_terms, status, notes,
        email, phone,
        sales_owner_id, assigned_to, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        companyName, industry, country, city, address, website,
        taxId, creditLimit || 0, paymentTerms || 30,
        status || 'prospect', notes,
        email || null, phone || null,
        salesOwner, salesOwner, req.user!.id
      ]
    );

    const ctx = getActivityContext(req);
    await logActivity({
      ...ctx,
      action: 'customer_created',
      entityType: 'customer',
      entityId: result.rows[0].id,
      entityLabel: companyName,
      description: `Customer created: ${companyName}`,
      newValues: { companyName, industry, country, status },
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create customer' });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      companyName, industry, country, city, address, website,
      taxId, creditLimit, paymentTerms, status, notes, assignedTo,
      email, phone, salesOwnerId
    } = req.body;

    // Non-admin can only update customers assigned to them
    const isAdmin = req.user?.role === 'Admin';
    if (!isAdmin) {
      const check = await query('SELECT sales_owner_id, assigned_to, created_by FROM customers WHERE id=$1', [id]);
      if (check.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Customer not found' });
        return;
      }
      const c = check.rows[0];
      if (c.sales_owner_id !== req.user!.id && c.assigned_to !== req.user!.id && c.created_by !== req.user!.id) {
        res.status(403).json({ success: false, message: 'You can only update your own customers' });
        return;
      }
    }

    const result = await query(
      `UPDATE customers SET
        company_name = COALESCE($1, company_name),
        industry = COALESCE($2, industry),
        country = COALESCE($3, country),
        city = COALESCE($4, city),
        address = COALESCE($5, address),
        website = COALESCE($6, website),
        tax_id = COALESCE($7, tax_id),
        credit_limit = COALESCE($8, credit_limit),
        payment_terms = COALESCE($9, payment_terms),
        status = COALESCE($10, status),
        notes = COALESCE($11, notes),
        assigned_to = COALESCE($12, assigned_to),
        email = COALESCE($13, email),
        phone = COALESCE($14, phone),
        sales_owner_id = COALESCE($15, sales_owner_id),
        updated_at = NOW()
       WHERE id = $16 RETURNING *`,
      [companyName, industry, country, city, address, website,
       taxId, creditLimit, paymentTerms, status, notes,
       assignedTo, email, phone,
       isAdmin ? (salesOwnerId || null) : null,
       id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    const ctx = getActivityContext(req);
    await logActivity({
      ...ctx,
      action: 'customer_updated',
      entityType: 'customer',
      entityId: id,
      entityLabel: result.rows[0].company_name,
      description: `Customer updated: ${result.rows[0].company_name}`,
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update customer' });
  }
};

export const deleteCustomer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user?.role !== 'Admin') {
      res.status(403).json({ success: false, message: 'Only admins can delete customers' });
      return;
    }

    const result = await query('DELETE FROM customers WHERE id=$1 RETURNING id, company_name', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    const ctx = getActivityContext(req);
    await logActivity({
      ...ctx,
      action: 'customer_deleted',
      entityType: 'customer',
      entityId: id,
      entityLabel: result.rows[0].company_name,
      description: `Customer deleted: ${result.rows[0].company_name}`,
    });

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
