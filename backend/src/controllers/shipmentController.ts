import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const getShipments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, customerId, isDelayed, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }
    if (customerId) { params.push(customerId); conditions.push(`s.customer_id = $${params.length}`); }
    if (isDelayed === 'true') { conditions.push(`s.is_delayed = true`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.reference_number ILIKE $${params.length} OR c.company_name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await query(
      `SELECT COUNT(*) FROM shipments s LEFT JOIN customers c ON s.customer_id = c.id ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(Number(limit), offset);
    const result = await query(
      `SELECT s.*, c.company_name as customer_name, c.country as customer_country,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        (SELECT COUNT(*) FROM tickets WHERE shipment_id = s.id AND status != 'closed') as open_ticket_count
       FROM shipments s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN users u ON s.assigned_to = u.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: result.rows, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error('getShipments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shipments' });
  }
};

export const getShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT s.*, c.company_name as customer_name, c.country as customer_country,
        u.first_name || ' ' || u.last_name as assigned_to_name,
        (SELECT JSON_AGG(m.* ORDER BY m.planned_date ASC) FROM shipment_milestones m WHERE m.shipment_id = s.id) as milestones,
        (SELECT JSON_AGG(t.* ORDER BY t.created_at DESC) FROM tickets t WHERE t.shipment_id = s.id) as tickets,
        (SELECT ROW_TO_JSON(i.*) FROM invoices i WHERE i.shipment_id = s.id LIMIT 1) as invoice
       FROM shipments s
       LEFT JOIN customers c ON s.customer_id = c.id
       LEFT JOIN users u ON s.assigned_to = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch shipment' });
  }
};

export const createShipment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      customerId, opportunityId, shippingMode, serviceType, originCountry, originPort,
      destinationCountry, destinationPort, cargoDescription, cargoWeight, cargoVolume,
      cargoUnits, containerNumber, blNumber, awbNumber, carrier, eta, etd, incoterm, assignedTo
    } = req.body;

    const refNum = `SHP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const result = await query(
      `INSERT INTO shipments (reference_number, customer_id, opportunity_id, shipping_mode, service_type,
       status, origin_country, origin_port, destination_country, destination_port, cargo_description,
       cargo_weight, cargo_volume, cargo_units, container_number, bl_number, awb_number, carrier,
       eta, etd, incoterm, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5,'booking',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [refNum, customerId, opportunityId, shippingMode, serviceType, originCountry, originPort,
       destinationCountry, destinationPort, cargoDescription, cargoWeight, cargoVolume, cargoUnits,
       containerNumber, blNumber, awbNumber, carrier, eta, etd, incoterm,
       assignedTo || req.user!.id, req.user!.id]
    );

    const shipmentId = result.rows[0].id;

    // Create default milestones
    const milestones = [
      { type: 'Booking Confirmed', days: 0 },
      { type: 'Cargo Pickup', days: 2 },
      { type: 'Export Customs', days: 3 },
      { type: 'Vessel/Flight Departure', days: 5 },
      { type: 'In Transit', days: 10 },
      { type: 'Arrival at Destination', days: 20 },
      { type: 'Import Customs', days: 22 },
      { type: 'Final Delivery', days: 25 },
    ];

    for (const milestone of milestones) {
      const plannedDate = new Date();
      plannedDate.setDate(plannedDate.getDate() + milestone.days);
      await query(
        `INSERT INTO shipment_milestones (shipment_id, milestone_type, status, planned_date) VALUES ($1,$2,'pending',$3)`,
        [shipmentId, milestone.type, plannedDate]
      );
    }

    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1,'shipment_created','shipment',$2)`,
      [req.user!.id, shipmentId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createShipment error:', error);
    res.status(500).json({ success: false, message: 'Failed to create shipment' });
  }
};

export const updateShipmentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, isDelayed, delayReason, atd, ata } = req.body;

    const result = await query(
      `UPDATE shipments SET status=$1, is_delayed=$2, delay_reason=$3,
       atd=COALESCE($4, atd), ata=COALESCE($5, ata), updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [status, isDelayed || false, delayReason, atd, ata, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Shipment not found' });
      return;
    }

    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1,'shipment_status_updated','shipment',$2,$3)`,
      [req.user!.id, id, JSON.stringify({ status, isDelayed })]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update shipment status' });
  }
};

export const updateMilestone = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, milestoneId } = req.params;
    const { status, actualDate, location, notes } = req.body;

    const result = await query(
      `UPDATE shipment_milestones SET status=$1, actual_date=$2, location=$3, notes=$4,
       completed_by=$5, updated_at=NOW()
       WHERE id=$6 AND shipment_id=$7 RETURNING *`,
      [status, actualDate || (status === 'completed' ? new Date() : null),
       location, notes, req.user!.id, milestoneId, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Milestone not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update milestone' });
  }
};
