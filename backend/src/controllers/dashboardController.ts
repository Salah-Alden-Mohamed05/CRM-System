import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      shipmentStats, revenueStats, ticketStats, salesStats,
      delayedShipments, overdueInvoices, recentActivity
    ] = await Promise.all([
      // Shipment statistics
      query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status NOT IN ('delivered','cancelled')) as active,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE is_delayed = true) as delayed,
          COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit
        FROM shipments
      `),

      // Revenue statistics
      query(`
        SELECT
          COALESCE(SUM(total_amount),0) as total_invoiced,
          COALESCE(SUM(paid_amount),0) as total_paid,
          COALESCE(SUM(outstanding_amount),0) as total_outstanding,
          COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'overdue'), 0) as overdue_amount
        FROM invoices WHERE status != 'cancelled'
      `),

      // Ticket statistics
      query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open_count,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('resolved','closed')) as critical,
          COUNT(*) FILTER (WHERE sla_breach = true) as sla_breached,
          AVG(EXTRACT(EPOCH FROM (resolved_at - opened_at))/3600) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours
        FROM tickets
      `),

      // Sales statistics
      query(`
        SELECT
          COUNT(*) as total_opportunities,
          COUNT(*) FILTER (WHERE stage = 'won') as won,
          COUNT(*) FILTER (WHERE stage = 'lost') as lost,
          COUNT(*) FILTER (WHERE stage NOT IN ('won','lost')) as active,
          COALESCE(SUM(value) FILTER (WHERE stage = 'won'), 0) as won_value,
          COALESCE(SUM(value * probability / 100), 0) as weighted_pipeline
        FROM opportunities
      `),

      // Delayed shipments
      query(`
        SELECT s.reference_number, s.status, s.delay_reason,
          c.company_name as customer_name,
          s.origin_country, s.destination_country, s.eta
        FROM shipments s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.is_delayed = true ORDER BY s.eta ASC LIMIT 5
      `),

      // Overdue invoices
      query(`
        SELECT i.invoice_number, i.outstanding_amount, i.due_date, i.currency,
          c.company_name as customer_name
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        WHERE i.status = 'overdue'
        ORDER BY i.due_date ASC LIMIT 5
      `),

      // Recent activity
      query(`
        SELECT al.*, u.first_name || ' ' || u.last_name as user_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC LIMIT 10
      `)
    ]);

    res.json({
      success: true,
      data: {
        shipments: shipmentStats.rows[0],
        revenue: revenueStats.rows[0],
        tickets: ticketStats.rows[0],
        sales: salesStats.rows[0],
        delayedShipments: delayedShipments.rows,
        overdueInvoices: overdueInvoices.rows,
        recentActivity: recentActivity.rows,
      },
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
};

export const getRevenueChart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = '12' } = req.query;
    const months = Math.min(parseInt(period as string), 24);

    const result = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', issue_date), 'YYYY-MM') as month,
        TO_CHAR(DATE_TRUNC('month', issue_date), 'Mon YYYY') as label,
        COALESCE(SUM(total_amount),0) as invoiced,
        COALESCE(SUM(paid_amount),0) as collected,
        COALESCE(SUM(outstanding_amount),0) as outstanding,
        COUNT(*) as invoice_count
      FROM invoices
      WHERE issue_date >= DATE_TRUNC('month', NOW() - INTERVAL '${months} months')
        AND status != 'cancelled'
      GROUP BY DATE_TRUNC('month', issue_date)
      ORDER BY DATE_TRUNC('month', issue_date)
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch revenue chart' });
  }
};

export const getShipmentChart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [byStatus, byMode, monthlyTrend] = await Promise.all([
      query(`
        SELECT status, COUNT(*) as count
        FROM shipments GROUP BY status ORDER BY count DESC
      `),
      query(`
        SELECT shipping_mode, COUNT(*) as count
        FROM shipments WHERE shipping_mode IS NOT NULL
        GROUP BY shipping_mode ORDER BY count DESC
      `),
      query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as label,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_delayed) as delayed
        FROM shipments
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `)
    ]);

    res.json({ success: true, data: { byStatus: byStatus.rows, byMode: byMode.rows, monthlyTrend: monthlyTrend.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch shipment chart' });
  }
};

export const getSalesFunnel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT
        stage,
        COUNT(*) as count,
        COALESCE(SUM(value),0) as total_value,
        COALESCE(AVG(probability),0) as avg_probability,
        COALESCE(SUM(value * probability / 100),0) as weighted_value
      FROM opportunities
      GROUP BY stage
      ORDER BY CASE stage WHEN 'lead' THEN 1 WHEN 'contacted' THEN 2 WHEN 'quotation' THEN 3
        WHEN 'negotiation' THEN 4 WHEN 'won' THEN 5 WHEN 'lost' THEN 6 END
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch sales funnel' });
  }
};

export const getCustomerProfitability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT
        c.id, c.company_name, c.country,
        COUNT(DISTINCT s.id) as shipment_count,
        COALESCE(SUM(i.total_amount),0) as total_revenue,
        COALESCE(SUM(co.amount),0) as total_costs,
        COALESCE(SUM(i.total_amount),0) - COALESCE(SUM(co.amount),0) as profit,
        CASE WHEN COALESCE(SUM(i.total_amount),0) > 0
          THEN ROUND(((COALESCE(SUM(i.total_amount),0) - COALESCE(SUM(co.amount),0)) / COALESCE(SUM(i.total_amount),0) * 100)::numeric, 2)
          ELSE 0 END as profit_margin
      FROM customers c
      LEFT JOIN shipments s ON s.customer_id = c.id
      LEFT JOIN invoices i ON i.customer_id = c.id AND i.status != 'cancelled'
      LEFT JOIN costs co ON co.shipment_id = s.id
      GROUP BY c.id, c.company_name, c.country
      ORDER BY profit DESC
      LIMIT 20
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch customer profitability' });
  }
};

export const getKPIs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);

    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM shipments WHERE created_at >= NOW() - INTERVAL '${days} days') as new_shipments,
        (SELECT COUNT(*) FROM customers WHERE created_at >= NOW() - INTERVAL '${days} days') as new_customers,
        (SELECT COALESCE(SUM(total_amount),0) FROM invoices WHERE issue_date >= NOW() - INTERVAL '${days} days') as period_revenue,
        (SELECT COUNT(*) FROM tickets WHERE created_at >= NOW() - INTERVAL '${days} days') as new_tickets,
        (SELECT COUNT(*) FROM tickets WHERE resolved_at >= NOW() - INTERVAL '${days} days') as resolved_tickets,
        (SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - opened_at))/3600) FROM tickets WHERE resolved_at >= NOW() - INTERVAL '${days} days') as avg_resolution_hours,
        (SELECT COUNT(*) FROM shipments WHERE is_delayed = true AND status NOT IN ('delivered','cancelled')) as current_delayed,
        (SELECT COUNT(*) FROM opportunities WHERE stage NOT IN ('won','lost')) as active_pipeline_count,
        (SELECT COALESCE(SUM(value * probability / 100),0) FROM opportunities WHERE stage NOT IN ('won','lost')) as pipeline_value
    `);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch KPIs' });
  }
};
