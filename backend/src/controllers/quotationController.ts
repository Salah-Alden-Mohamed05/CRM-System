import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

// ─── GET ALL QUOTATIONS ───────────────────────────────────────────────────────
export const getQuotations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { dealId, rfqId, customerId, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (dealId) { params.push(dealId); conditions.push(`q.deal_id = $${params.length}`); }
    if (rfqId) { params.push(rfqId); conditions.push(`q.rfq_id = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`q.customer_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`q.status = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(`SELECT COUNT(*) FROM quotations q ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT q.*,
        c.company_name as customer_name,
        d.title as deal_title, d.deal_number,
        r.rfq_number,
        cr.first_name || ' ' || cr.last_name as created_by_name
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN deals d ON q.deal_id = d.id
       LEFT JOIN rfqs r ON q.rfq_id = r.id
       LEFT JOIN users cr ON q.created_by = cr.id
       ${where}
       ORDER BY q.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getQuotations error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quotations' });
  }
};

// ─── GET SINGLE QUOTATION ─────────────────────────────────────────────────────
export const getQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT q.*,
        c.company_name as customer_name, c.email as customer_email,
        c.address as customer_address, c.city as customer_city,
        c.country as customer_country,
        d.title as deal_title, d.deal_number,
        r.rfq_number, r.shipping_mode as rfq_shipping_mode,
        r.origin_country as rfq_origin, r.destination_country as rfq_destination,
        cr.first_name || ' ' || cr.last_name as created_by_name,
        (SELECT JSON_AGG(qi.* ORDER BY qi.sort_order ASC) FROM quotation_items qi WHERE qi.quotation_id = q.id) as items,
        (SELECT JSON_AGG(doc.* ORDER BY doc.created_at DESC) FROM documents doc WHERE doc.quotation_id = q.id) as documents
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN deals d ON q.deal_id = d.id
       LEFT JOIN rfqs r ON q.rfq_id = r.id
       LEFT JOIN users cr ON q.created_by = cr.id
       WHERE q.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Quotation not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quotation' });
  }
};

// ─── CREATE QUOTATION ─────────────────────────────────────────────────────────
export const createQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      rfqId, dealId, customerId, validUntil, currency = 'USD',
      originCharges = 0, freightCost = 0, destinationCharges = 0,
      customsClearance = 0, insurance = 0, otherCharges = 0,
      taxRate = 0, transitTimeDays, paymentTerms, notes, termsConditions,
      items = []
    } = req.body;

    if (!customerId) {
      res.status(400).json({ success: false, message: 'Customer is required' });
      return;
    }

    // Calculate totals
    const subtotal = Number(originCharges) + Number(freightCost) + Number(destinationCharges) +
                     Number(customsClearance) + Number(insurance) + Number(otherCharges);
    const taxAmount = subtotal * (Number(taxRate) / 100);
    const totalAmount = subtotal + taxAmount;

    const result = await query(
      `INSERT INTO quotations (
        rfq_id, deal_id, customer_id, valid_until, currency,
        origin_charges, freight_cost, destination_charges,
        customs_clearance, insurance, other_charges,
        subtotal, tax_rate, tax_amount, total_amount,
        transit_time_days, payment_terms, notes, terms_conditions, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [rfqId || null, dealId || null, customerId, validUntil, currency,
       originCharges, freightCost, destinationCharges, customsClearance, insurance, otherCharges,
       subtotal, taxRate, taxAmount, totalAmount,
       transitTimeDays, paymentTerms, notes, termsConditions, req.user!.id]
    );

    const quotationId = result.rows[0].id;

    // Insert line items
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await query(
          `INSERT INTO quotation_items (quotation_id, category, description, quantity, unit, unit_price, amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [quotationId, item.category, item.description, item.quantity || 1,
           item.unit, item.unitPrice, item.amount, i]
        );
      }
    }

    // If linked to deal, advance deal to 'quotation' stage
    if (dealId) {
      await query(
        `UPDATE deals SET stage = 'quotation', updated_at = NOW()
         WHERE id = $1 AND stage IN ('lead','contacted','rfq')`,
        [dealId]
      );
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'quotation_uploaded', $3)`,
        [dealId, req.user!.id, `Quotation ${result.rows[0].quotation_number} created`]
      );
    }

    // Audit log
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'created', 'quotation', $2, $3)`,
      [req.user!.id, quotationId, JSON.stringify({ label: result.rows[0].quotation_number, role: req.user!.role, name: `${req.user!.firstName} ${req.user!.lastName}` })]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Quotation created successfully' });
  } catch (error) {
    console.error('createQuotation error:', error);
    res.status(500).json({ success: false, message: 'Failed to create quotation' });
  }
};

// ─── UPDATE QUOTATION ─────────────────────────────────────────────────────────
export const updateQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Quotation not found' }); return;
    }

    const {
      status, validUntil, currency, originCharges, freightCost, destinationCharges,
      customsClearance, insurance, otherCharges, taxRate, transitTimeDays,
      paymentTerms, notes, termsConditions, rejectionReason, pdfUrl, items
    } = req.body;

    // Recalculate if charges updated
    const sub_o = originCharges ?? existing.rows[0].origin_charges;
    const sub_f = freightCost ?? existing.rows[0].freight_cost;
    const sub_d = destinationCharges ?? existing.rows[0].destination_charges;
    const sub_c = customsClearance ?? existing.rows[0].customs_clearance;
    const sub_i = insurance ?? existing.rows[0].insurance;
    const sub_oth = otherCharges ?? existing.rows[0].other_charges;
    const sub_tax = taxRate ?? existing.rows[0].tax_rate;
    const subtotal = Number(sub_o) + Number(sub_f) + Number(sub_d) + Number(sub_c) + Number(sub_i) + Number(sub_oth);
    const taxAmount = subtotal * (Number(sub_tax) / 100);
    const totalAmount = subtotal + taxAmount;

    const sentAt = status === 'sent' && existing.rows[0].status === 'draft' ? new Date() : null;
    const acceptedAt = status === 'accepted' ? new Date() : null;
    const rejectedAt = status === 'rejected' ? new Date() : null;

    const result = await query(
      `UPDATE quotations SET
        status = COALESCE($1, status),
        valid_until = COALESCE($2, valid_until),
        currency = COALESCE($3, currency),
        origin_charges = $4, freight_cost = $5, destination_charges = $6,
        customs_clearance = $7, insurance = $8, other_charges = $9,
        subtotal = $10, tax_rate = $11, tax_amount = $12, total_amount = $13,
        transit_time_days = COALESCE($14, transit_time_days),
        payment_terms = COALESCE($15, payment_terms),
        notes = COALESCE($16, notes),
        terms_conditions = COALESCE($17, terms_conditions),
        rejection_reason = COALESCE($18, rejection_reason),
        pdf_url = COALESCE($19, pdf_url),
        sent_at = COALESCE($20, sent_at),
        accepted_at = COALESCE($21, accepted_at),
        rejected_at = COALESCE($22, rejected_at),
        updated_at = NOW()
       WHERE id = $23 RETURNING *`,
      [status, validUntil, currency, sub_o, sub_f, sub_d, sub_c, sub_i, sub_oth,
       subtotal, sub_tax, taxAmount, totalAmount, transitTimeDays, paymentTerms,
       notes, termsConditions, rejectionReason, pdfUrl, sentAt, acceptedAt, rejectedAt, id]
    );

    // Update line items if provided
    if (items && items.length > 0) {
      await query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await query(
          `INSERT INTO quotation_items (quotation_id, category, description, quantity, unit, unit_price, amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, item.category, item.description, item.quantity || 1, item.unit, item.unitPrice, item.amount, i]
        );
      }
    }

    // If accepted, advance deal to won
    if (status === 'accepted' && existing.rows[0].deal_id) {
      await query(
        `UPDATE deals SET stage = 'won', probability = 100, updated_at = NOW() WHERE id = $1`,
        [existing.rows[0].deal_id]
      );
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'deal_won', $3)`,
        [existing.rows[0].deal_id, req.user!.id, `Quotation accepted - Deal won!`]
      );
    }

    res.json({ success: true, data: result.rows[0], message: 'Quotation updated successfully' });
  } catch (error) {
    console.error('updateQuotation error:', error);
    res.status(500).json({ success: false, message: 'Failed to update quotation' });
  }
};

// ─── DELETE QUOTATION ─────────────────────────────────────────────────────────
export const deleteQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await query('DELETE FROM quotations WHERE id = $1', [id]);
    res.json({ success: true, message: 'Quotation deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete quotation' });
  }
};
