import { query } from '../db/pool';

// ============================================================
// AI-POWERED SERVICES
// These use rule-based logic and statistical analysis to provide
// intelligent predictions and automation without external APIs
// ============================================================

export interface RiskScore {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  recommendation: string;
}

export interface DelayPrediction {
  probability: number;
  estimatedDelay: number; // days
  reasons: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface RevenueForeccast {
  nextMonth: number;
  nextQuarter: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}

// ============================================================
// SHIPMENT DELAY PREDICTION
// ============================================================
export async function predictShipmentDelay(shipmentId: string): Promise<DelayPrediction> {
  const result = await query(
    `SELECT s.*, c.company_name,
      (SELECT COUNT(*) FROM shipments WHERE customer_id = s.customer_id AND is_delayed = true) as customer_delay_count,
      (SELECT COUNT(*) FROM shipments WHERE customer_id = s.customer_id) as customer_total_shipments,
      (SELECT COUNT(*) FROM shipments WHERE shipping_mode = s.shipping_mode AND is_delayed = true) as mode_delay_count,
      (SELECT COUNT(*) FROM shipments WHERE shipping_mode = s.shipping_mode) as mode_total_shipments,
      EXTRACT(EPOCH FROM (COALESCE(s.eta, NOW() + INTERVAL '30 days') - NOW())) / 86400 as days_to_eta
     FROM shipments s
     LEFT JOIN customers c ON s.customer_id = c.id
     WHERE s.id = $1`,
    [shipmentId]
  );

  if (result.rows.length === 0) throw new Error('Shipment not found');

  const s = result.rows[0];
  const reasons: string[] = [];
  let probability = 0;

  // Factor 1: Customer history delay rate
  const customerDelayRate = s.customer_total_shipments > 0
    ? (s.customer_delay_count / s.customer_total_shipments) * 100
    : 15;
  if (customerDelayRate > 30) {
    probability += 25;
    reasons.push(`High customer delay history (${Math.round(customerDelayRate)}%)`);
  } else if (customerDelayRate > 15) {
    probability += 10;
    reasons.push(`Moderate customer delay history (${Math.round(customerDelayRate)}%)`);
  }

  // Factor 2: Shipping mode risk
  const modeDelayRate = s.mode_total_shipments > 0
    ? (s.mode_delay_count / s.mode_total_shipments) * 100
    : 10;
  if (modeDelayRate > 25) {
    probability += 20;
    reasons.push(`High delay rate for ${s.shipping_mode} shipping (${Math.round(modeDelayRate)}%)`);
  } else if (modeDelayRate > 15) {
    probability += 10;
  }

  // Factor 3: Route complexity (more countries = higher risk)
  const isHighRiskRoute = ['customs_export', 'customs_import'].includes(s.status);
  if (isHighRiskRoute) {
    probability += 15;
    reasons.push('Currently at customs (high delay risk)');
  }

  // Factor 4: ETA proximity
  if (s.days_to_eta < 3 && s.days_to_eta > 0) {
    probability += 10;
    reasons.push('Close to ETA with pending milestones');
  }

  // Factor 5: Already delayed
  if (s.is_delayed) {
    probability += 30;
    reasons.push('Shipment already flagged as delayed');
  }

  // Factor 6: Transit time baseline
  const transitDaysByMode: Record<string, number> = {
    air: 3, sea: 25, road: 7, rail: 14, multimodal: 20,
  };
  const expectedDays = transitDaysByMode[s.shipping_mode] || 20;
  const daysInTransit = s.etd ? (Date.now() - new Date(s.etd).getTime()) / 86400000 : 0;
  if (daysInTransit > expectedDays * 1.2) {
    probability += 15;
    reasons.push(`Shipment has been in transit longer than expected`);
  }

  probability = Math.min(probability, 95);

  const confidence = probability > 60 ? 'high' : probability > 30 ? 'medium' : 'low';
  const estimatedDelay = probability > 70 ? 5 : probability > 40 ? 3 : probability > 20 ? 1 : 0;

  return { probability, estimatedDelay, reasons, confidence };
}

// ============================================================
// CUSTOMER RISK SCORING
// ============================================================
export async function scoreCustomerRisk(customerId: string): Promise<RiskScore> {
  const result = await query(
    `SELECT c.*,
      COALESCE((SELECT SUM(outstanding_amount) FROM invoices WHERE customer_id = c.id AND status IN ('overdue','sent')), 0) as outstanding_debt,
      COALESCE((SELECT SUM(total_amount) FROM invoices WHERE customer_id = c.id AND status != 'cancelled'), 0) as total_business,
      (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id AND status = 'overdue') as overdue_invoices,
      (SELECT COUNT(*) FROM tickets WHERE customer_id = c.id AND status NOT IN ('resolved','closed')) as open_tickets,
      (SELECT COUNT(*) FROM shipments WHERE customer_id = c.id AND is_delayed = true) as delayed_shipments,
      (SELECT COUNT(*) FROM shipments WHERE customer_id = c.id) as total_shipments,
      EXTRACT(DAY FROM NOW() - MAX(inv.created_at)) as days_since_last_invoice
     FROM customers c
     LEFT JOIN invoices inv ON inv.customer_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [customerId]
  );

  if (result.rows.length === 0) throw new Error('Customer not found');

  const c = result.rows[0];
  const factors: string[] = [];
  let score = 0;

  // Factor 1: Payment behavior
  if (c.overdue_invoices > 2) {
    score += 35;
    factors.push(`${c.overdue_invoices} overdue invoices`);
  } else if (c.overdue_invoices === 1) {
    score += 15;
    factors.push('1 overdue invoice');
  }

  // Factor 2: Debt ratio
  const debtRatio = c.total_business > 0 ? (c.outstanding_debt / c.total_business) * 100 : 0;
  if (debtRatio > 50) {
    score += 25;
    factors.push(`High outstanding debt ratio (${Math.round(debtRatio)}%)`);
  } else if (debtRatio > 25) {
    score += 10;
    factors.push(`Moderate outstanding debt (${Math.round(debtRatio)}%)`);
  }

  // Factor 3: Open support tickets
  if (c.open_tickets > 3) {
    score += 15;
    factors.push(`${c.open_tickets} unresolved support tickets`);
  }

  // Factor 4: Delayed shipments rate
  const delayRate = c.total_shipments > 0 ? (c.delayed_shipments / c.total_shipments) * 100 : 0;
  if (delayRate > 30) {
    score += 15;
    factors.push(`High shipment delay rate (${Math.round(delayRate)}%)`);
  }

  // Factor 5: Credit limit utilization
  if (c.credit_limit > 0) {
    const utilization = (c.outstanding_debt / c.credit_limit) * 100;
    if (utilization > 80) {
      score += 20;
      factors.push(`Near credit limit (${Math.round(utilization)}% utilized)`);
    }
  }

  score = Math.min(score, 100);

  const level = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  const recommendation = score >= 75
    ? 'Immediate attention required. Consider payment plan and shipment hold.'
    : score >= 50
    ? 'Review credit terms and payment history. Contact customer directly.'
    : score >= 25
    ? 'Monitor closely. Send payment reminders.'
    : 'Good standing. Continue normal operations.';

  return { score, level, factors, recommendation };
}

// ============================================================
// REVENUE FORECASTING
// ============================================================
export async function forecastRevenue(): Promise<RevenueForeccast> {
  const result = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', issue_date), 'YYYY-MM') as month,
      SUM(total_amount) as revenue
    FROM invoices
    WHERE status != 'cancelled'
      AND issue_date >= NOW() - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', issue_date)
    ORDER BY DATE_TRUNC('month', issue_date)
  `);

  const data = result.rows.map(r => Number(r.revenue));

  if (data.length < 2) {
    return { nextMonth: 0, nextQuarter: 0, trend: 'stable', confidence: 0 };
  }

  // Simple linear regression
  const n = data.length;
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = data.reduce((s, _, i) => s + i * i, 0);
  const sumY = data.reduce((s, v) => s + v, 0);
  const sumXY = data.reduce((s, v, i) => s + i * v, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const nextMonth = Math.max(intercept + slope * n, 0);
  const nextQuarter = Math.max(
    nextMonth + (intercept + slope * (n + 1)) + (intercept + slope * (n + 2)),
    0
  );

  const trend = slope > data[data.length - 1] * 0.05
    ? 'up' : slope < -data[data.length - 1] * 0.05
    ? 'down' : 'stable';

  const confidence = Math.min(n * 15, 85);

  return { nextMonth, nextQuarter, trend, confidence };
}

// ============================================================
// AUTOMATED SLA BREACH DETECTION
// ============================================================
export async function checkSLABreaches(): Promise<void> {
  await query(`
    UPDATE tickets
    SET sla_breach = true
    WHERE status NOT IN ('resolved','closed')
      AND sla_hours > 0
      AND EXTRACT(EPOCH FROM (NOW() - opened_at))/3600 > sla_hours
      AND sla_breach = false
  `);
}

// ============================================================
// AUTO-UPDATE OVERDUE INVOICES
// ============================================================
export async function updateOverdueInvoices(): Promise<void> {
  await query(`
    UPDATE invoices
    SET status = 'overdue', updated_at = NOW()
    WHERE status IN ('sent','partial')
      AND due_date < CURRENT_DATE
  `);
}

// ============================================================
// SMART DEAL SCORING
// ============================================================
export async function scoreDeal(opportunityId: string): Promise<{
  score: number;
  label: string;
  insights: string[];
  recommendedActions: string[];
}> {
  const result = await query(
    `SELECT o.*,
      c.status as customer_status,
      COALESCE((SELECT SUM(total_amount) FROM invoices WHERE customer_id = o.customer_id AND status = 'paid'), 0) as customer_paid_total,
      (SELECT COUNT(*) FROM opportunities WHERE customer_id = o.customer_id AND stage = 'won') as past_wins,
      (SELECT COUNT(*) FROM opportunity_activities WHERE opportunity_id = o.id) as activity_count,
      EXTRACT(DAY FROM NOW() - o.created_at) as days_in_pipeline,
      EXTRACT(DAY FROM o.expected_close_date - NOW()) as days_to_close
     FROM opportunities o
     LEFT JOIN customers c ON o.customer_id = c.id
     WHERE o.id = $1`,
    [opportunityId]
  );

  if (result.rows.length === 0) throw new Error('Opportunity not found');

  const o = result.rows[0];
  const insights: string[] = [];
  const recommendedActions: string[] = [];
  let score = 0;

  // Base probability
  score += o.probability * 0.4;

  // Factor 1: Customer relationship
  if (o.past_wins > 3) {
    score += 20;
    insights.push(`Strong customer relationship (${o.past_wins} previous wins)`);
  } else if (o.past_wins > 0) {
    score += 10;
    insights.push(`Existing customer with ${o.past_wins} previous deals`);
  } else {
    insights.push('New customer relationship');
    recommendedActions.push('Schedule discovery meeting to understand requirements');
  }

  // Factor 2: Deal size
  if (o.value > 100000) {
    score += 10;
    insights.push('High-value deal - strategic opportunity');
    recommendedActions.push('Involve senior management in negotiations');
  }

  // Factor 3: Activity level
  if (o.activity_count > 5) {
    score += 10;
    insights.push(`Active engagement with ${o.activity_count} interactions`);
  } else if (o.activity_count === 0) {
    score -= 10;
    insights.push('No activities recorded');
    recommendedActions.push('Log recent interactions and schedule next touchpoint');
  }

  // Factor 4: Close date proximity
  if (o.days_to_close < 0) {
    score -= 15;
    insights.push('Past expected close date');
    recommendedActions.push('Update expected close date or reassess deal');
  } else if (o.days_to_close < 14) {
    score += 5;
    insights.push('Close to expected close date');
  }

  // Factor 5: Customer payment history
  if (Number(o.customer_paid_total) > 50000) {
    score += 5;
    insights.push('Customer has strong payment history');
  }

  score = Math.min(Math.max(score, 0), 100);
  const label = score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : score >= 40 ? 'Cool' : 'Cold';

  return { score: Math.round(score), label, insights, recommendedActions };
}

// ============================================================
// GENERATE AI INSIGHTS FOR DASHBOARD
// ============================================================
export async function generateInsights(): Promise<Array<{
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}>> {
  const insights = [];

  // Check SLA breaches
  await checkSLABreaches();
  await updateOverdueInvoices();

  const [slaResult, overdueResult, delayedResult, bigDealsResult] = await Promise.all([
    query(`SELECT COUNT(*) as count FROM tickets WHERE sla_breach = true AND status NOT IN ('resolved','closed')`),
    query(`SELECT COUNT(*) as count, SUM(outstanding_amount) as amount FROM invoices WHERE status = 'overdue'`),
    query(`SELECT COUNT(*) as count FROM shipments WHERE is_delayed = true AND status NOT IN ('delivered','cancelled')`),
    query(`SELECT COUNT(*) as count FROM opportunities WHERE stage = 'negotiation' AND value > 50000 AND expected_close_date <= NOW() + INTERVAL '7 days'`),
  ]);

  const slaCount = parseInt(slaResult.rows[0].count);
  const overdueCount = parseInt(overdueResult.rows[0].count);
  const overdueAmount = Number(overdueResult.rows[0].amount || 0);
  const delayedCount = parseInt(delayedResult.rows[0].count);
  const bigDealsCount = parseInt(bigDealsResult.rows[0].count);

  if (slaCount > 0) {
    insights.push({
      type: 'sla',
      severity: 'critical' as const,
      title: `${slaCount} SLA Breach${slaCount > 1 ? 'es' : ''}`,
      message: `${slaCount} ticket${slaCount > 1 ? 's have' : ' has'} breached their SLA. Immediate action required.`,
      actionLabel: 'View Tickets',
      actionUrl: '/tickets?status=open',
    });
  }

  if (overdueCount > 0) {
    insights.push({
      type: 'overdue',
      severity: 'warning' as const,
      title: `$${overdueAmount.toLocaleString()} Outstanding`,
      message: `${overdueCount} overdue invoice${overdueCount > 1 ? 's' : ''} totaling $${overdueAmount.toLocaleString()}. Review and follow up.`,
      actionLabel: 'View Invoices',
      actionUrl: '/finance?status=overdue',
    });
  }

  if (delayedCount > 0) {
    insights.push({
      type: 'delay',
      severity: delayedCount > 3 ? 'critical' as const : 'warning' as const,
      title: `${delayedCount} Delayed Shipment${delayedCount > 1 ? 's' : ''}`,
      message: `${delayedCount} active shipment${delayedCount > 1 ? 's are' : ' is'} currently delayed. Customer communication recommended.`,
      actionLabel: 'View Shipments',
      actionUrl: '/shipments?isDelayed=true',
    });
  }

  if (bigDealsCount > 0) {
    insights.push({
      type: 'deals',
      severity: 'info' as const,
      title: `${bigDealsCount} High-Value Deal${bigDealsCount > 1 ? 's' : ''} Closing Soon`,
      message: `${bigDealsCount} deal${bigDealsCount > 1 ? 's' : ''} over $50k expected to close within 7 days. Follow up to win.`,
      actionLabel: 'View Pipeline',
      actionUrl: '/sales',
    });
  }

  return insights;
}
