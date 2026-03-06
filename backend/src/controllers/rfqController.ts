import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

// ─── GET ALL RFQs ────────────────────────────────────────────────────────────
export const getRFQs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { dealId, customerId, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    const role = req.user?.role;
    // Sales: only own deals' RFQs
    if (role === 'Sales') {
      params.push(req.user!.id);
      conditions.push(`(d.assigned_to = $${params.length} OR d.created_by = $${params.length})`);
    }

    if (dealId) { params.push(dealId); conditions.push(`r.deal_id = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`r.customer_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(
      `SELECT COUNT(*) FROM rfqs r
       LEFT JOIN deals d ON r.deal_id = d.id
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT r.*,
        c.company_name as customer_name,
        d.title as deal_title, d.deal_number,
        sub.first_name || ' ' || sub.last_name as submitted_by_name,
        asn.first_name || ' ' || asn.last_name as assigned_to_name
       FROM rfqs r
       LEFT JOIN customers c ON r.customer_id = c.id
       LEFT JOIN deals d ON r.deal_id = d.id
       LEFT JOIN users sub ON r.submitted_by = sub.id
       LEFT JOIN users asn ON r.assigned_to = asn.id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getRFQs error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch RFQs' });
  }
};

// ─── GET SINGLE RFQ ──────────────────────────────────────────────────────────
export const getRFQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT r.*,
        c.company_name as customer_name, c.email as customer_email,
        d.title as deal_title, d.deal_number, d.stage as deal_stage,
        sub.first_name || ' ' || sub.last_name as submitted_by_name,
        asn.first_name || ' ' || asn.last_name as assigned_to_name,
        (SELECT JSON_AGG(q.* ORDER BY q.created_at DESC) FROM quotations q WHERE q.rfq_id = r.id) as quotations,
        (SELECT JSON_AGG(doc.* ORDER BY doc.created_at DESC) FROM documents doc WHERE doc.rfq_id = r.id) as documents
       FROM rfqs r
       LEFT JOIN customers c ON r.customer_id = c.id
       LEFT JOIN deals d ON r.deal_id = d.id
       LEFT JOIN users sub ON r.submitted_by = sub.id
       LEFT JOIN users asn ON r.assigned_to = asn.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'RFQ not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch RFQ' });
  }
};

// ─── CREATE RFQ (from deal or standalone) ───────────────────────────────────
export const createRFQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      dealId, customerId, originCountry, originPort, originAddress,
      destinationCountry, destinationPort, destinationAddress,
      shippingMode, serviceType, incoterms, cargoType, cargoDescription,
      weightKg, volumeCbm, quantity, unitType, containerType, containerCount,
      hazardous, hazmatClass, temperatureControlled, tempRange,
      insuranceRequired, customsClearanceRequired,
      cargoReadyDate, requiredDeliveryDate, specialInstructions, notes, assignedTo,
      customFields
    } = req.body;

    if (!customerId) {
      res.status(400).json({ success: false, message: 'Customer is required' });
      return;
    }

    const result = await query(
      `INSERT INTO rfqs (
        deal_id, customer_id, origin_country, origin_port, origin_address,
        destination_country, destination_port, destination_address,
        shipping_mode, service_type, incoterms, cargo_type, cargo_description,
        weight_kg, volume_cbm, quantity, unit_type, container_type, container_count,
        hazardous, hazmat_class, temperature_controlled, temp_range,
        insurance_required, customs_clearance_required,
        cargo_ready_date, required_delivery_date, special_instructions, notes,
        submitted_by, assigned_to, custom_fields
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
      RETURNING *`,
      [
        dealId || null, customerId, originCountry, originPort, originAddress,
        destinationCountry, destinationPort, destinationAddress,
        shippingMode, serviceType, incoterms, cargoType, cargoDescription,
        weightKg, volumeCbm, quantity, unitType, containerType, containerCount,
        hazardous || false, hazmatClass, temperatureControlled || false, tempRange,
        insuranceRequired || false, customsClearanceRequired || false,
        cargoReadyDate, requiredDeliveryDate, specialInstructions, notes,
        req.user!.id, assignedTo || null, JSON.stringify(customFields || {})
      ]
    );

    // If linked to a deal, advance deal stage to 'rfq'
    if (dealId) {
      await query(
        `UPDATE deals SET stage = 'rfq', updated_at = NOW() WHERE id = $1 AND stage IN ('lead','contacted')`,
        [dealId]
      );
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'rfq_submitted', $3)`,
        [dealId, req.user!.id, `RFQ ${result.rows[0].rfq_number} submitted`]
      );
    }

    // Audit log
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, 'created', 'rfq', $2, $3)`,
      [req.user!.id, result.rows[0].id, JSON.stringify({ label: result.rows[0].rfq_number, role: req.user!.role, name: `${req.user!.firstName} ${req.user!.lastName}` })]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'RFQ created successfully' });
  } catch (error) {
    console.error('createRFQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to create RFQ' });
  }
};

// ─── UPDATE RFQ STATUS ────────────────────────────────────────────────────────
export const updateRFQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM rfqs WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'RFQ not found' }); return;
    }

    const {
      status, assignedTo, notes, originCountry, originPort, destinationCountry,
      destinationPort, shippingMode, serviceType, weightKg, volumeCbm, specialInstructions
    } = req.body;

    const result = await query(
      `UPDATE rfqs SET
        status = COALESCE($1, status),
        assigned_to = COALESCE($2, assigned_to),
        notes = COALESCE($3, notes),
        origin_country = COALESCE($4, origin_country),
        origin_port = COALESCE($5, origin_port),
        destination_country = COALESCE($6, destination_country),
        destination_port = COALESCE($7, destination_port),
        shipping_mode = COALESCE($8, shipping_mode),
        service_type = COALESCE($9, service_type),
        weight_kg = COALESCE($10, weight_kg),
        volume_cbm = COALESCE($11, volume_cbm),
        special_instructions = COALESCE($12, special_instructions),
        updated_at = NOW()
       WHERE id = $13 RETURNING *`,
      [status, assignedTo, notes, originCountry, originPort, destinationCountry,
       destinationPort, shippingMode, serviceType, weightKg, volumeCbm, specialInstructions, id]
    );

    res.json({ success: true, data: result.rows[0], message: 'RFQ updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update RFQ' });
  }
};
