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

    if (dealId)     { params.push(dealId);     conditions.push(`q.deal_id = $${params.length}`); }
    if (rfqId)      { params.push(rfqId);      conditions.push(`q.rfq_id = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`q.customer_id = $${params.length}`); }
    if (status)     { params.push(status);     conditions.push(`q.status = $${params.length}`); }

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
        c.address as customer_address, c.city as customer_city, c.country as customer_country,
        c.phone as customer_phone, c.tax_id as customer_tax_id,
        d.title as deal_title, d.deal_number,
        r.rfq_number, r.shipping_mode as rfq_shipping_mode,
        r.origin_country as rfq_origin_country, r.origin_port as rfq_origin_port,
        r.destination_country as rfq_destination_country, r.destination_port as rfq_destination_port,
        r.cargo_description as rfq_cargo_description,
        r.weight_kg as rfq_weight_kg, r.volume_cbm as rfq_volume_cbm,
        r.service_type as rfq_service_type, r.incoterms as rfq_incoterms,
        r.cargo_type as rfq_cargo_type,
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
    const role = req.user?.role;
    // Permission: Operations, Finance, Admin can create quotations
    if (!['Operations', 'Finance', 'Admin', 'Sales'].includes(role || '')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions to create quotations' });
      return;
    }

    const {
      rfqId, dealId, customerId,
      quotationDate, validUntil, currency = 'USD',
      // Pricing breakdown
      originCharges = 0, freightCost = 0, destinationCharges = 0,
      customsClearance = 0, insurance = 0, otherCharges = 0,
      taxRate = 0,
      // Operational
      carrier, transitTimeDays, preferredRouteNotes,
      paymentTerms, notes, termsConditions,
      // Shipment info (auto-filled from RFQ)
      shipmentOriginCountry, shipmentOriginPort,
      shipmentDestinationCountry, shipmentDestinationPort,
      shipmentMode, shipmentServiceType, shipmentIncoterms,
      shipmentCargoDescription, shipmentWeightKg, shipmentVolumeCbm,
      // Client info
      clientContactName, clientContactEmail, clientContactPhone,
      // Items
      items = []
    } = req.body;

    if (!customerId) {
      res.status(400).json({ success: false, message: 'Customer is required' });
      return;
    }

    // If rfqId provided, auto-fill shipment data from RFQ
    let rfqData: any = null;
    if (rfqId) {
      const rfqResult = await query('SELECT * FROM rfqs WHERE id = $1', [rfqId]);
      if (rfqResult.rows.length > 0) {
        rfqData = rfqResult.rows[0];
      }
    }

    // Use RFQ data as fallback for shipment fields
    const finalOriginCountry = shipmentOriginCountry || rfqData?.origin_country;
    const finalOriginPort = shipmentOriginPort || rfqData?.origin_port;
    const finalDestCountry = shipmentDestinationCountry || rfqData?.destination_country;
    const finalDestPort = shipmentDestinationPort || rfqData?.destination_port;
    const finalMode = shipmentMode || rfqData?.shipping_mode;
    const finalServiceType = shipmentServiceType || rfqData?.service_type;
    const finalIncoterms = shipmentIncoterms || rfqData?.incoterms;
    const finalCargoDes = shipmentCargoDescription || rfqData?.cargo_description;
    const finalWeight = shipmentWeightKg || rfqData?.weight_kg;
    const finalVolume = shipmentVolumeCbm || rfqData?.volume_cbm;

    // Calculate totals
    const subtotal = Number(originCharges) + Number(freightCost) + Number(destinationCharges) +
                     Number(customsClearance) + Number(insurance) + Number(otherCharges);
    const taxAmount = subtotal * (Number(taxRate) / 100);
    const totalAmount = subtotal + taxAmount;

    const result = await query(
      `INSERT INTO quotations (
        rfq_id, deal_id, customer_id,
        quotation_date, valid_until, currency,
        origin_charges, freight_cost, destination_charges,
        customs_clearance, insurance, other_charges,
        subtotal, tax_rate, tax_amount, total_amount,
        carrier, transit_time_days, preferred_route_notes,
        payment_terms, notes, terms_conditions,
        shipment_origin_country, shipment_origin_port,
        shipment_destination_country, shipment_destination_port,
        shipment_mode, shipment_service_type, shipment_incoterms,
        shipment_cargo_description, shipment_weight_kg, shipment_volume_cbm,
        client_contact_name, client_contact_email, client_contact_phone,
        created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
        $33,$34,$35,$36
      )
      RETURNING *`,
      [
        rfqId || null, dealId || null, customerId,
        quotationDate || new Date().toISOString().split('T')[0],
        validUntil, currency,
        originCharges, freightCost, destinationCharges,
        customsClearance, insurance, otherCharges,
        subtotal, taxRate, taxAmount, totalAmount,
        carrier, transitTimeDays || null, preferredRouteNotes,
        paymentTerms, notes, termsConditions,
        finalOriginCountry, finalOriginPort,
        finalDestCountry, finalDestPort,
        finalMode, finalServiceType, finalIncoterms,
        finalCargoDes, finalWeight, finalVolume,
        clientContactName, clientContactEmail, clientContactPhone,
        req.user!.id
      ]
    );

    const quotationId = result.rows[0].id;
    const quotationNumber = result.rows[0].quotation_number;

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
         WHERE id = $1 AND stage IN ('lead','contacted','rfq','key_person_reached','follow_up')`,
        [dealId]
      );
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'quotation_uploaded', $3)`,
        [dealId, req.user!.id, `Quotation ${quotationNumber} created — deal moved to Quoted stage`]
      );
    }

    // If linked to RFQ, update RFQ status to quoted
    if (rfqId) {
      await query(
        `UPDATE rfqs SET status = 'quoted', updated_at = NOW() WHERE id = $1`,
        [rfqId]
      );
    }

    // Audit log
    await query(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, entity_type, entity_id, entity_label, metadata)
       VALUES ($1, $2, $3, 'created', 'quotation', $4, $5, $6)`,
      [
        req.user!.id,
        `${req.user!.firstName} ${req.user!.lastName}`,
        req.user!.role,
        quotationId,
        quotationNumber,
        JSON.stringify({ rfqId, dealId, customerId, totalAmount, currency })
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: `Quotation ${quotationNumber} created successfully`
    });
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
      status, quotationDate, validUntil, currency,
      originCharges, freightCost, destinationCharges,
      customsClearance, insurance, otherCharges, taxRate,
      carrier, transitTimeDays, preferredRouteNotes,
      paymentTerms, notes, termsConditions, rejectionReason, pdfUrl,
      shipmentOriginCountry, shipmentOriginPort,
      shipmentDestinationCountry, shipmentDestinationPort,
      shipmentMode, shipmentServiceType, shipmentIncoterms,
      shipmentCargoDescription, shipmentWeightKg, shipmentVolumeCbm,
      clientContactName, clientContactEmail, clientContactPhone,
      items
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
        quotation_date = COALESCE($2, quotation_date),
        valid_until = COALESCE($3, valid_until),
        currency = COALESCE($4, currency),
        origin_charges = $5, freight_cost = $6, destination_charges = $7,
        customs_clearance = $8, insurance = $9, other_charges = $10,
        subtotal = $11, tax_rate = $12, tax_amount = $13, total_amount = $14,
        carrier = COALESCE($15, carrier),
        transit_time_days = COALESCE($16, transit_time_days),
        preferred_route_notes = COALESCE($17, preferred_route_notes),
        payment_terms = COALESCE($18, payment_terms),
        notes = COALESCE($19, notes),
        terms_conditions = COALESCE($20, terms_conditions),
        rejection_reason = COALESCE($21, rejection_reason),
        pdf_url = COALESCE($22, pdf_url),
        sent_at = COALESCE($23, sent_at),
        accepted_at = COALESCE($24, accepted_at),
        rejected_at = COALESCE($25, rejected_at),
        shipment_origin_country = COALESCE($26, shipment_origin_country),
        shipment_origin_port = COALESCE($27, shipment_origin_port),
        shipment_destination_country = COALESCE($28, shipment_destination_country),
        shipment_destination_port = COALESCE($29, shipment_destination_port),
        shipment_mode = COALESCE($30, shipment_mode),
        shipment_service_type = COALESCE($31, shipment_service_type),
        shipment_incoterms = COALESCE($32, shipment_incoterms),
        shipment_cargo_description = COALESCE($33, shipment_cargo_description),
        shipment_weight_kg = COALESCE($34, shipment_weight_kg),
        shipment_volume_cbm = COALESCE($35, shipment_volume_cbm),
        client_contact_name = COALESCE($36, client_contact_name),
        client_contact_email = COALESCE($37, client_contact_email),
        client_contact_phone = COALESCE($38, client_contact_phone),
        updated_at = NOW()
       WHERE id = $39 RETURNING *`,
      [
        status, quotationDate, validUntil, currency,
        sub_o, sub_f, sub_d, sub_c, sub_i, sub_oth,
        subtotal, sub_tax, taxAmount, totalAmount,
        carrier, transitTimeDays, preferredRouteNotes,
        paymentTerms, notes, termsConditions, rejectionReason, pdfUrl,
        sentAt, acceptedAt, rejectedAt,
        shipmentOriginCountry, shipmentOriginPort,
        shipmentDestinationCountry, shipmentDestinationPort,
        shipmentMode, shipmentServiceType, shipmentIncoterms,
        shipmentCargoDescription, shipmentWeightKg, shipmentVolumeCbm,
        clientContactName, clientContactEmail, clientContactPhone,
        id
      ]
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
        `UPDATE deals SET stage = 'won', probability = 100, actual_close_date = CURRENT_DATE, updated_at = NOW()
         WHERE id = $1`,
        [existing.rows[0].deal_id]
      );
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'deal_won', $3)`,
        [existing.rows[0].deal_id, req.user!.id,
         `Quotation ${existing.rows[0].quotation_number} accepted — Deal Won! 🎉`]
      );
    }

    // Audit log
    await query(
      `INSERT INTO activity_logs (user_id, user_name, user_role, action, entity_type, entity_id, entity_label, new_values)
       VALUES ($1, $2, $3, 'updated', 'quotation', $4, $5, $6::jsonb)`,
      [
        req.user!.id,
        `${req.user!.firstName} ${req.user!.lastName}`,
        req.user!.role,
        id,
        existing.rows[0].quotation_number,
        JSON.stringify({ status, totalAmount })
      ]
    );

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
    const role = req.user?.role;
    if (!['Admin', 'Finance', 'Operations'].includes(role || '')) {
      res.status(403).json({ success: false, message: 'Permission denied' }); return;
    }
    await query('DELETE FROM quotations WHERE id = $1', [id]);
    res.json({ success: true, message: 'Quotation deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete quotation' });
  }
};

// ─── SEND QUOTATION EMAIL ─────────────────────────────────────────────────────
export const sendQuotationEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const role = req.user?.role;

    // Permission: Sales (view/send), Operations (send/edit), Admin (full)
    if (!['Admin', 'Finance', 'Operations', 'Sales'].includes(role || '')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const quotResult = await query(
      `SELECT q.*,
        c.company_name as customer_name, c.email as customer_email,
        d.title as deal_title, d.deal_number
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN deals d ON q.deal_id = d.id
       WHERE q.id = $1`,
      [id]
    );

    if (quotResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Quotation not found' });
      return;
    }

    const quot = quotResult.rows[0];
    const {
      recipientEmail,
      recipientName,
      subject,
      body,
      ccEmails = []
    } = req.body;

    if (!recipientEmail) {
      res.status(400).json({ success: false, message: 'Recipient email is required' });
      return;
    }

    // Log the email in quotation_emails table
    await query(
      `INSERT INTO quotation_emails
         (quotation_id, deal_id, sent_by, sent_by_name, recipient_email, recipient_name, subject, body, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent')`,
      [
        id,
        quot.deal_id,
        req.user!.id,
        `${req.user!.firstName} ${req.user!.lastName}`,
        recipientEmail,
        recipientName || quot.customer_name,
        subject || `Quotation ${quot.quotation_number} – ${quot.customer_name}`,
        body || `Please find attached quotation ${quot.quotation_number}.`
      ]
    );

    // Update quotation: status -> sent, email count, last recipient
    await query(
      `UPDATE quotations SET
        status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
        sent_at = CASE WHEN sent_at IS NULL THEN NOW() ELSE sent_at END,
        email_sent_count = COALESCE(email_sent_count, 0) + 1,
        last_email_sent_at = NOW(),
        last_email_recipient = $1,
        updated_at = NOW()
       WHERE id = $2`,
      [recipientEmail, id]
    );

    // Log in deal activity timeline
    if (quot.deal_id) {
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'quotation_sent', $3)`,
        [
          quot.deal_id,
          req.user!.id,
          `Quotation ${quot.quotation_number} sent to ${recipientEmail} by ${req.user!.firstName} ${req.user!.lastName}`
        ]
      );
      // Advance deal stage to quotation if not already
      await query(
        `UPDATE deals SET stage = 'quotation', updated_at = NOW()
         WHERE id = $1 AND stage IN ('lead','contacted','rfq','key_person_reached','follow_up','rfq_requested')`,
        [quot.deal_id]
      );
    }

    res.json({
      success: true,
      message: `Quotation ${quot.quotation_number} email logged successfully`,
      data: { quotationNumber: quot.quotation_number, recipientEmail, sentAt: new Date() }
    });
  } catch (error) {
    console.error('sendQuotationEmail error:', error);
    res.status(500).json({ success: false, message: 'Failed to send quotation email' });
  }
};

// ─── DUPLICATE QUOTATION ──────────────────────────────────────────────────────
export const duplicateQuotation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const role = req.user?.role;

    if (!['Admin', 'Finance', 'Operations', 'Sales'].includes(role || '')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    // Fetch the source quotation
    const srcResult = await query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (srcResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Quotation not found' });
      return;
    }

    const src = srcResult.rows[0];

    // Create duplicate with status = draft
    const newResult = await query(
      `INSERT INTO quotations (
        rfq_id, deal_id, customer_id,
        quotation_date, valid_until, currency,
        origin_charges, freight_cost, destination_charges,
        customs_clearance, insurance, other_charges,
        subtotal, tax_rate, tax_amount, total_amount,
        carrier, transit_time_days, preferred_route_notes,
        payment_terms, notes, terms_conditions,
        shipment_origin_country, shipment_origin_port,
        shipment_destination_country, shipment_destination_port,
        shipment_mode, shipment_service_type, shipment_incoterms,
        shipment_cargo_description, shipment_weight_kg, shipment_volume_cbm,
        client_contact_name, client_contact_email, client_contact_phone,
        source_quotation_id, status, created_by
      ) VALUES (
        $1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
        $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,
        $32,$33,$34,$35,'draft',$36
      ) RETURNING *`,
      [
        src.rfq_id, src.deal_id, src.customer_id,
        src.valid_until, src.currency,
        src.origin_charges, src.freight_cost, src.destination_charges,
        src.customs_clearance, src.insurance, src.other_charges,
        src.subtotal, src.tax_rate, src.tax_amount, src.total_amount,
        src.carrier, src.transit_time_days, src.preferred_route_notes,
        src.payment_terms, src.notes, src.terms_conditions,
        src.shipment_origin_country, src.shipment_origin_port,
        src.shipment_destination_country, src.shipment_destination_port,
        src.shipment_mode, src.shipment_service_type, src.shipment_incoterms,
        src.shipment_cargo_description, src.shipment_weight_kg, src.shipment_volume_cbm,
        src.client_contact_name, src.client_contact_email, src.client_contact_phone,
        id, req.user!.id
      ]
    );

    const newQuot = newResult.rows[0];

    // Copy line items
    const itemsResult = await query(
      `SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY sort_order`,
      [id]
    );
    for (const item of itemsResult.rows) {
      await query(
        `INSERT INTO quotation_items (quotation_id, category, description, quantity, unit, unit_price, amount, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [newQuot.id, item.category, item.description, item.quantity, item.unit, item.unit_price, item.amount, item.sort_order]
      );
    }

    // Log activity
    if (src.deal_id) {
      await query(
        `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
         VALUES ($1, $2, 'quotation_duplicated', $3)`,
        [
          src.deal_id, req.user!.id,
          `Quotation ${src.quotation_number} duplicated → new quotation ${newQuot.quotation_number} (Draft)`
        ]
      );
    }

    res.status(201).json({
      success: true,
      data: newQuot,
      message: `Quotation duplicated as ${newQuot.quotation_number}`
    });
  } catch (error) {
    console.error('duplicateQuotation error:', error);
    res.status(500).json({ success: false, message: 'Failed to duplicate quotation' });
  }
};

// ─── GET QUOTATION EMAIL HISTORY ──────────────────────────────────────────────
export const getQuotationEmails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT qe.*, u.first_name || ' ' || u.last_name as sent_by_name
       FROM quotation_emails qe
       LEFT JOIN users u ON qe.sent_by = u.id
       WHERE qe.quotation_id = $1
       ORDER BY qe.sent_at DESC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch email history' });
  }
};

// ─── CHECK & EXPIRE QUOTATIONS ────────────────────────────────────────────────
export const expireQuotations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `UPDATE quotations
       SET status = 'expired', updated_at = NOW()
       WHERE status IN ('draft','sent')
         AND valid_until IS NOT NULL
         AND valid_until < CURRENT_DATE
       RETURNING id, quotation_number, deal_id`,
    );
    // Log expired activities
    for (const q of result.rows) {
      if (q.deal_id) {
        await query(
          `INSERT INTO deal_activities (deal_id, user_id, activity_type, description)
           VALUES ($1, $2, 'quotation_expired', $3)`,
          [q.deal_id, req.user?.id || null, `Quotation ${q.quotation_number} has expired (past valid until date)`]
        );
      }
    }
    res.json({ success: true, expired: result.rowCount, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to expire quotations' });
  }
};

// ─── GENERATE PDF DATA ────────────────────────────────────────────────────────
export const getQuotationPDFData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT q.*,
        c.company_name as customer_name, c.email as customer_email,
        c.address as customer_address, c.city as customer_city, c.country as customer_country,
        c.phone as customer_phone, c.tax_id as customer_tax_id,
        d.title as deal_title, d.deal_number,
        r.rfq_number,
        cr.first_name || ' ' || cr.last_name as created_by_name,
        (SELECT JSON_AGG(qi.* ORDER BY qi.sort_order ASC) FROM quotation_items qi WHERE qi.quotation_id = q.id) as items
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

    // Mark PDF as generated
    await query(
      `UPDATE quotations SET pdf_generated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get PDF data' });
  }
};
