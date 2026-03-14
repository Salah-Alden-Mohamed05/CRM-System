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
    // Sales: only see their own deals' RFQs
    if (role === 'Sales') {
      params.push(req.user!.id);
      conditions.push(`(d.assigned_to = $${params.length} OR d.created_by = $${params.length} OR r.submitted_by = $${params.length})`);
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
        d.title as deal_title, d.deal_number, d.stage as deal_stage,
        sub.first_name || ' ' || sub.last_name as submitted_by_name,
        asn.first_name || ' ' || asn.last_name as assigned_to_name,
        (SELECT COUNT(*) FROM quotations q WHERE q.rfq_id = r.id) as quotation_count,
        (SELECT COUNT(*) FROM documents doc WHERE doc.rfq_id = r.id) as document_count
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
        c.address as customer_address, c.city as customer_city, c.country as customer_country,
        d.title as deal_title, d.deal_number, d.stage as deal_stage,
        sub.first_name || ' ' || sub.last_name as submitted_by_name,
        asn.first_name || ' ' || asn.last_name as assigned_to_name,
        ops.first_name || ' ' || ops.last_name as preferred_ops_name,
        (SELECT JSON_AGG(q.* ORDER BY q.created_at DESC) FROM quotations q WHERE q.rfq_id = r.id) as quotations,
        (SELECT JSON_AGG(doc.* ORDER BY doc.created_at DESC) FROM documents doc WHERE doc.rfq_id = r.id) as documents
       FROM rfqs r
       LEFT JOIN customers c ON r.customer_id = c.id
       LEFT JOIN deals d ON r.deal_id = d.id
       LEFT JOIN users sub ON r.submitted_by = sub.id
       LEFT JOIN users asn ON r.assigned_to = asn.id
       LEFT JOIN users ops ON r.preferred_ops_user_id = ops.id
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

// ─── CREATE RFQ ──────────────────────────────────────────────────────────────
export const createRFQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user?.role;
    // Permission: only Sales, Admin can create
    if (!['Sales', 'Admin'].includes(role || '')) {
      res.status(403).json({ success: false, message: 'Only Sales or Admin can create RFQs' });
      return;
    }

    const {
      dealId, customerId,
      // Route
      originCountry, originPort, originAddress,
      destinationCountry, destinationPort, destinationAddress,
      // Shipment Basics
      shippingMode, serviceType, incoterms,
      // Cargo
      cargoType, cargoDescription,
      weightKg, volumeCbm, quantity, unitType,
      // Container Details (FCL)
      containerType, containerCount, containerType2, containerCount2,
      // Cargo Nature
      cargoNature,
      // Special Cargo
      hazardous, hazmatClass, unNumber, imoClass, packingGroup, flashPoint,
      perishable, perishableType,
      // Other cargo flags
      stackable, fragile, oversized, dimensionsLwh,
      // Temperature
      temperatureControlled, tempRange,
      // Trade Terms
      insuranceRequired, customsClearanceRequired,
      // Value Added Services
      valueAddedServices,
      // Timeline
      cargoReadyDate, requiredDeliveryDate,
      // Other
      specialInstructions, notes, assignedTo, preferredOpsUserId,
      customFields
    } = req.body;

    if (!customerId) {
      res.status(400).json({ success: false, message: 'Customer is required' });
      return;
    }

    // Verify deal exists and belongs to this sales rep
    if (dealId) {
      const dealCheck = await query('SELECT id, assigned_to, created_by, stage FROM deals WHERE id = $1', [dealId]);
      if (dealCheck.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Deal not found' });
        return;
      }
      if (role === 'Sales') {
        const deal = dealCheck.rows[0];
        if (deal.assigned_to !== req.user!.id && deal.created_by !== req.user!.id) {
          res.status(403).json({ success: false, message: 'You can only create RFQs for your own deals' });
          return;
        }
      }
    }

    const result = await query(
      `INSERT INTO rfqs (
        deal_id, customer_id,
        origin_country, origin_port, origin_address,
        destination_country, destination_port, destination_address,
        shipping_mode, service_type, incoterms,
        cargo_type, cargo_description,
        weight_kg, volume_cbm, quantity, unit_type,
        container_type, container_count, container_type_2, container_count_2,
        cargo_nature,
        hazardous, hazmat_class, un_number, imo_class, packing_group, flash_point,
        perishable, perishable_type,
        stackable, fragile, oversized, dimensions_lwh,
        temperature_controlled, temp_range,
        insurance_required, customs_clearance_required,
        value_added_services,
        cargo_ready_date, required_delivery_date,
        special_instructions, notes,
        submitted_by, assigned_to, preferred_ops_user_id,
        custom_fields, status, submitted_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
        $33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,
        'sent_to_ops', NOW()
      )
      RETURNING *`,
      [
        dealId || null, customerId,
        originCountry, originPort, originAddress,
        destinationCountry, destinationPort, destinationAddress,
        shippingMode, serviceType, incoterms,
        cargoType, cargoDescription,
        weightKg || null, volumeCbm || null, quantity || null, unitType,
        containerType, containerCount || null, containerType2 || null, containerCount2 || null,
        JSON.stringify(cargoNature || {}),
        hazardous || false, hazmatClass, unNumber, imoClass, packingGroup, flashPoint,
        perishable || false, perishableType,
        stackable !== false, fragile || false, oversized || false, dimensionsLwh,
        temperatureControlled || false, tempRange,
        insuranceRequired || false, customsClearanceRequired || false,
        JSON.stringify(valueAddedServices || []),
        cargoReadyDate || null, requiredDeliveryDate || null,
        specialInstructions, notes,
        req.user!.id, assignedTo || null, preferredOpsUserId || null,
        JSON.stringify(customFields || {})
      ]
    );

    const rfq = result.rows[0];

    // Advance deal stage to 'rfq' if it was in lead/contacted
    if (dealId) {
      await query(
        `UPDATE deals SET stage = 'rfq', updated_at = NOW()
         WHERE id = $1 AND stage IN ('lead','contacted','key_person_reached','follow_up')`,
        [dealId]
      );
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'rfq_submitted', $3)`,
        [dealId, req.user!.id, `RFQ ${rfq.rfq_number} submitted — awaiting Operations pricing`]
      );
    }

    // Audit log
    await query(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, entity_type, entity_id, entity_label, metadata)
       VALUES ($1, $2, $3, 'created', 'rfq', $4, $5, $6)`,
      [
        req.user!.id,
        `${req.user!.firstName} ${req.user!.lastName}`,
        req.user!.role,
        rfq.id,
        rfq.rfq_number,
        JSON.stringify({ dealId, customerId, shippingMode, serviceType })
      ]
    );

    res.status(201).json({
      success: true,
      data: rfq,
      message: `RFQ ${rfq.rfq_number} submitted successfully — Operations team notified`
    });
  } catch (error) {
    console.error('createRFQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to create RFQ' });
  }
};

// ─── UPDATE RFQ ──────────────────────────────────────────────────────────────
export const updateRFQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const role = req.user?.role;

    const existing = await query(
      `SELECT r.*, d.assigned_to as deal_assigned_to, d.created_by as deal_created_by
       FROM rfqs r LEFT JOIN deals d ON r.deal_id = d.id
       WHERE r.id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'RFQ not found' }); return;
    }

    const rfq = existing.rows[0];
    // Sales can only edit their own RFQs (before they are in 'pricing' stage)
    if (role === 'Sales') {
      if (rfq.submitted_by !== req.user!.id && rfq.deal_assigned_to !== req.user!.id) {
        res.status(403).json({ success: false, message: 'Permission denied' }); return;
      }
      if (['pricing', 'quoted', 'approved'].includes(rfq.status)) {
        res.status(400).json({ success: false, message: 'RFQ is already in pricing — cannot edit' }); return;
      }
    }

    const {
      status, assignedTo, notes,
      originCountry, originPort, destinationCountry, destinationPort,
      shippingMode, serviceType, weightKg, volumeCbm, specialInstructions,
      cargoNature, valueAddedServices, hazardous, hazmatClass,
      unNumber, imoClass, packingGroup, flashPoint,
      perishable, perishableType, stackable, fragile, oversized,
      temperatureControlled, tempRange, insuranceRequired, customsClearanceRequired,
      preferredOpsUserId, opsNotifiedAt
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
        cargo_nature = COALESCE($13::jsonb, cargo_nature),
        value_added_services = COALESCE($14::jsonb, value_added_services),
        hazardous = COALESCE($15, hazardous),
        hazmat_class = COALESCE($16, hazmat_class),
        un_number = COALESCE($17, un_number),
        imo_class = COALESCE($18, imo_class),
        packing_group = COALESCE($19, packing_group),
        flash_point = COALESCE($20, flash_point),
        perishable = COALESCE($21, perishable),
        perishable_type = COALESCE($22, perishable_type),
        stackable = COALESCE($23, stackable),
        fragile = COALESCE($24, fragile),
        oversized = COALESCE($25, oversized),
        temperature_controlled = COALESCE($26, temperature_controlled),
        temp_range = COALESCE($27, temp_range),
        insurance_required = COALESCE($28, insurance_required),
        customs_clearance_required = COALESCE($29, customs_clearance_required),
        preferred_ops_user_id = COALESCE($30, preferred_ops_user_id),
        ops_notified_at = COALESCE($31, ops_notified_at),
        updated_at = NOW()
       WHERE id = $32 RETURNING *`,
      [
        status, assignedTo, notes,
        originCountry, originPort, destinationCountry, destinationPort,
        shippingMode, serviceType, weightKg, volumeCbm, specialInstructions,
        cargoNature ? JSON.stringify(cargoNature) : null,
        valueAddedServices ? JSON.stringify(valueAddedServices) : null,
        hazardous, hazmatClass, unNumber, imoClass, packingGroup, flashPoint,
        perishable, perishableType, stackable, fragile, oversized,
        temperatureControlled, tempRange, insuranceRequired, customsClearanceRequired,
        preferredOpsUserId, opsNotifiedAt, id
      ]
    );

    // If status changed to 'quoted', update deal stage
    if (status === 'quoted' && rfq.deal_id) {
      await query(
        `UPDATE deals SET stage = 'quotation', updated_at = NOW()
         WHERE id = $1 AND stage IN ('rfq','lead','contacted')`,
        [rfq.deal_id]
      );
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'quotation_uploaded', 'Operations uploaded quotation — deal moved to Quotation stage')`,
        [rfq.deal_id, req.user!.id]
      );
    }

    // Audit log
    await query(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, entity_type, entity_id, entity_label, new_values)
       VALUES ($1, $2, $3, 'updated', 'rfq', $4, $5, $6::jsonb)`,
      [
        req.user!.id,
        `${req.user!.firstName} ${req.user!.lastName}`,
        req.user!.role,
        id, rfq.rfq_number,
        JSON.stringify({ status, assignedTo })
      ]
    );

    res.json({ success: true, data: result.rows[0], message: 'RFQ updated successfully' });
  } catch (error) {
    console.error('updateRFQ error:', error);
    res.status(500).json({ success: false, message: 'Failed to update RFQ' });
  }
};

// ─── DELETE RFQ ──────────────────────────────────────────────────────────────
export const deleteRFQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const role = req.user?.role;
    if (role !== 'Admin') {
      res.status(403).json({ success: false, message: 'Only Admin can delete RFQs' }); return;
    }
    await query('DELETE FROM rfqs WHERE id = $1', [id]);
    res.json({ success: true, message: 'RFQ deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete RFQ' });
  }
};
