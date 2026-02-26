import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const getInvoices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, customerId, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (status) { params.push(status); conditions.push(`i.status = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`i.customer_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM invoices i ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT i.*,
        c.company_name as customer_name,
        s.reference_number as shipment_reference,
        u.first_name || ' ' || u.last_name as created_by_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN shipments s ON i.shipment_id = s.id
       LEFT JOIN users u ON i.created_by = u.id
       ${where}
       ORDER BY i.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Auto-update overdue invoices
    await query(
      `UPDATE invoices SET status='overdue' WHERE status='sent' AND due_date < CURRENT_DATE`
    );

    res.json({ success: true, data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getInvoices error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
  }
};

export const getInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT i.*,
        c.company_name as customer_name, c.address as customer_address, c.country as customer_country,
        s.reference_number as shipment_reference,
        (SELECT JSON_AGG(ii.* ORDER BY ii.created_at ASC) FROM invoice_items ii WHERE ii.invoice_id = i.id) as items,
        (SELECT JSON_AGG(p.* ORDER BY p.payment_date DESC) FROM payments p WHERE p.invoice_id = i.id) as payments
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN shipments s ON i.shipment_id = s.id
       WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch invoice' });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customerId, shipmentId, issueDate, dueDate, items, taxRate, discountAmount, notes, currency } = req.body;

    const invoiceNum = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const subtotal = items.reduce((sum: number, item: { amount: number }) => sum + Number(item.amount), 0);
    const taxAmount = subtotal * (Number(taxRate || 0) / 100);
    const totalAmount = subtotal + taxAmount - Number(discountAmount || 0);

    const result = await query(
      `INSERT INTO invoices (invoice_number, customer_id, shipment_id, status, issue_date, due_date,
       subtotal, tax_rate, tax_amount, discount_amount, total_amount, paid_amount, outstanding_amount,
       currency, notes, created_by)
       VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,0,$10,$11,$12,$13) RETURNING *`,
      [invoiceNum, customerId, shipmentId, issueDate, dueDate, subtotal, taxRate || 0,
       taxAmount, discountAmount || 0, totalAmount, currency || 'USD', notes, req.user!.id]
    );

    const invoiceId = result.rows[0].id;

    // Insert invoice items
    for (const item of items) {
      await query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
         VALUES ($1,$2,$3,$4,$5)`,
        [invoiceId, item.description, item.quantity || 1, item.unitPrice, item.amount]
      );
    }

    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1,'invoice_created','invoice',$2)`,
      [req.user!.id, invoiceId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create invoice' });
  }
};

export const recordPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { invoiceId, amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;

    const invoiceResult = await query('SELECT total_amount, paid_amount FROM invoices WHERE id=$1', [invoiceId]);
    if (invoiceResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }

    const invoice = invoiceResult.rows[0];
    const newPaidAmount = Number(invoice.paid_amount) + Number(amount);
    const newOutstanding = Number(invoice.total_amount) - newPaidAmount;
    const newStatus = newOutstanding <= 0 ? 'paid' : 'partial';

    const paymentResult = await query(
      `INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference_number, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [invoiceId, amount, paymentDate, paymentMethod, referenceNumber, notes, req.user!.id]
    );

    await query(
      `UPDATE invoices SET paid_amount=$1, outstanding_amount=$2, status=$3, updated_at=NOW() WHERE id=$4`,
      [newPaidAmount, Math.max(0, newOutstanding), newStatus, invoiceId]
    );

    res.status(201).json({ success: true, data: paymentResult.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to record payment' });
  }
};

export const getCosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shipmentId } = req.params;
    const result = await query(
      `SELECT c.*,
        (SELECT SUM(amount) FROM costs WHERE shipment_id=$1) as total_costs,
        (SELECT SUM(total_amount) FROM invoices WHERE shipment_id=$1) as total_revenue
       FROM costs c WHERE c.shipment_id=$1 ORDER BY c.created_at DESC`,
      [shipmentId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch costs' });
  }
};

export const addCost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shipmentId } = req.params;
    const { costType, description, amount, currency, vendor, costDate } = req.body;

    const result = await query(
      `INSERT INTO costs (shipment_id, cost_type, description, amount, currency, vendor, cost_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [shipmentId, costType, description, amount, currency || 'USD', vendor, costDate, req.user!.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add cost' });
  }
};
