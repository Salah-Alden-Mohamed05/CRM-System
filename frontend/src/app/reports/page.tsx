'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { dashboardAPI } from '@/lib/api';
import { Card, Loading, StatCard } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import {
  BarChart2, DollarSign, TrendingUp, Users, Package,
  AlertTriangle, Clock, CheckCircle, Ship, Plane, Truck,
  Target, Award, RefreshCw, Calendar, ArrowRight,
  TrendingDown, Activity
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, PieChart, Pie,
} from 'recharts';
import Link from 'next/link';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const SHIPMENT_COLORS: Record<string, string> = {
  booking: '#6366f1', pickup: '#8b5cf6', customs_export: '#f59e0b',
  departed: '#3b82f6', in_transit: '#06b6d4', customs_import: '#f97316',
  arrived: '#84cc16', delivered: '#10b981', cancelled: '#ef4444', delayed: '#f97316',
};
const STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8', contacted: '#3b82f6', rfq: '#8b5cf6',
  quotation: '#f59e0b', negotiation: '#f97316', won: '#10b981', lost: '#ef4444',
};

export default function ReportsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const { isRTL } = useTranslation();
  const [revenueData, setRevenueData] = useState<unknown[]>([]);
  const [shipmentData, setShipmentData] = useState<{ byStatus: unknown[]; byMode: unknown[]; monthlyTrend: unknown[] } | null>(null);
  const [salesFunnel, setSalesFunnel] = useState<unknown[]>([]);
  const [profitability, setProfitability] = useState<unknown[]>([]);
  const [kpis, setKpis] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('12');
  const [activeSection, setActiveSection] = useState<'overview' | 'sales' | 'operations' | 'finance'>('overview');

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isOps = user?.role?.toLowerCase() === 'operations';
  const isFinance = user?.role?.toLowerCase() === 'finance';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, shipRes, salesRes, profRes, kpiRes] = await Promise.all([
        dashboardAPI.getRevenueChart({ period }),
        dashboardAPI.getShipmentChart(),
        dashboardAPI.getSalesFunnel(),
        dashboardAPI.getCustomerProfitability(),
        dashboardAPI.getKPIs({ period: 30 }),
      ]);
      setRevenueData(revRes.data.data);
      setShipmentData(shipRes.data.data);
      setSalesFunnel(salesRes.data.data);
      setProfitability(profRes.data.data);
      setKpis(kpiRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (!isAdmin && !isOps && !isFinance) { router.replace('/dashboard'); return; }
    fetchData();
  }, [isAuthenticated, router, fetchData, isAdmin, isOps, isFinance]);

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);

  if (loading) return <MainLayout><div className="p-8"><Loading /></div></MainLayout>;

  // Derived metrics
  const rd = revenueData as Array<{invoiced?: number; collected?: number; outstanding?: number; label?: string}>;
  const totalInv = rd.reduce((s, r) => s + Number(r.invoiced || 0), 0);
  const totalCol = rd.reduce((s, r) => s + Number(r.collected || 0), 0);
  const totalOut = totalInv - totalCol;
  const collectionRate = totalInv > 0 ? Math.round((totalCol / totalInv) * 100) : 0;

  const sections = [
    { id: 'overview' as const, label: isRTL ? 'نظرة عامة' : 'Overview', icon: BarChart2 },
    { id: 'sales' as const, label: isRTL ? 'المبيعات' : 'Sales', icon: TrendingUp, hidden: isOps },
    { id: 'operations' as const, label: isRTL ? 'العمليات' : 'Operations', icon: Package, hidden: isFinance && !isAdmin },
    { id: 'finance' as const, label: isRTL ? 'المالية' : 'Finance', icon: DollarSign, hidden: isOps && !isAdmin },
  ].filter(s => !s.hidden);

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-screen-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-600" />
              {isRTL ? 'التقارير والتحليلات' : 'Reports & Analytics'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isRTL ? 'مؤشرات الأداء الرئيسية ومتابعة الأعمال' : 'Key performance indicators and business intelligence'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {['3', '6', '12', '24'].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {p}{isRTL ? 'ش' : 'M'}
                </button>
              ))}
            </div>
            <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg border border-gray-200">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* ── KPI Summary Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <Package className="w-5 h-5 opacity-80 mb-2" />
            <div className="text-2xl font-bold">{kpis.new_shipments || 0}</div>
            <div className="text-xs text-blue-100 mt-0.5">{isRTL ? 'شحنات جديدة (30 يوم)' : 'New Shipments (30d)'}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
            <DollarSign className="w-5 h-5 opacity-80 mb-2" />
            <div className="text-2xl font-bold">{fmt(Number(kpis.period_revenue || 0))}</div>
            <div className="text-xs text-emerald-100 mt-0.5">{isRTL ? 'الإيرادات (30 يوم)' : 'Revenue (30d)'}</div>
          </div>
          <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white">
            <TrendingUp className="w-5 h-5 opacity-80 mb-2" />
            <div className="text-2xl font-bold">{fmt(Number(kpis.pipeline_value || 0))}</div>
            <div className="text-xs text-violet-100 mt-0.5">{isRTL ? 'قيمة خط الأنابيب' : 'Pipeline Value'}</div>
          </div>
          <div className={`bg-gradient-to-br rounded-xl p-4 text-white ${(kpis.current_delayed || 0) > 0 ? 'from-orange-500 to-orange-600' : 'from-gray-400 to-gray-500'}`}>
            <AlertTriangle className="w-5 h-5 opacity-80 mb-2" />
            <div className="text-2xl font-bold">{kpis.current_delayed || 0}</div>
            <div className="text-xs opacity-80 mt-0.5">{isRTL ? 'شحنات متأخرة حالياً' : 'Active Delayed'}</div>
          </div>
        </div>

        {/* ── Section Tabs ── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeSection === s.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <s.icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ══════════════════ OVERVIEW ══════════════════ */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Revenue Trend Chart */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    {isRTL ? 'اتجاه الإيرادات' : 'Revenue Trend'}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{isRTL ? 'الفواتير مقابل المبالغ المحصَّلة' : 'Invoiced vs. collected payments'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    {isRTL ? 'فواتير' : 'Invoiced'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    {isRTL ? 'محصَّل' : 'Collected'}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueData as unknown[]}>
                  <defs>
                    <linearGradient id="inv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="col" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                  <Tooltip formatter={(v) => fmt(Number(v ?? 0))} />
                  <Area type="monotone" dataKey="invoiced" name={isRTL ? 'الفواتير' : 'Invoiced'} stroke="#3b82f6" fill="url(#inv)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="collected" name={isRTL ? 'المحصَّل' : 'Collected'} stroke="#10b981" fill="url(#col)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              {/* Summary Row */}
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{isRTL ? 'إجمالي الفواتير' : 'Total Invoiced'}</p>
                  <p className="text-sm font-bold text-blue-600">{fmt(totalInv)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{isRTL ? 'إجمالي المحصَّل' : 'Total Collected'}</p>
                  <p className="text-sm font-bold text-emerald-600">{fmt(totalCol)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{isRTL ? 'الرصيد المستحق' : 'Outstanding'}</p>
                  <p className={`text-sm font-bold ${totalOut > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{fmt(Math.max(totalOut, 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{isRTL ? 'نسبة التحصيل' : 'Collection Rate'}</p>
                  <p className={`text-sm font-bold ${collectionRate >= 80 ? 'text-emerald-600' : collectionRate >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>{collectionRate}%</p>
                </div>
              </div>
            </Card>

            {/* 30-Day KPIs Table */}
            <Card>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-violet-500" />
                {isRTL ? 'ملخص أداء 30 يوماً' : '30-Day Performance Summary'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { label: isRTL ? 'شحنات جديدة' : 'New Shipments', value: kpis.new_shipments || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: isRTL ? 'عملاء جدد' : 'New Customers', value: kpis.new_customers || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: isRTL ? 'تذاكر جديدة' : 'New Tickets', value: kpis.new_tickets || 0, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: isRTL ? 'تذاكر محلولة' : 'Resolved Tickets', value: kpis.resolved_tickets || 0, color: 'text-violet-600', bg: 'bg-violet-50' },
                  { label: isRTL ? 'وقت الحل (ساعة)' : 'Avg Resolution (h)', value: kpis.avg_resolution_hours ? Number(kpis.avg_resolution_hours).toFixed(1) : 'N/A', color: 'text-cyan-600', bg: 'bg-cyan-50' },
                  { label: isRTL ? 'متأخرة الآن' : 'Currently Delayed', value: kpis.current_delayed || 0, color: `${(kpis.current_delayed || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`, bg: `${(kpis.current_delayed || 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}` },
                  { label: isRTL ? 'صفقات في المسار' : 'Active Pipeline', value: kpis.active_pipeline_count || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: isRTL ? 'قيمة المسار' : 'Pipeline Value', value: fmt(Number(kpis.pipeline_value || 0)), color: 'text-violet-600', bg: 'bg-violet-50' },
                  { label: isRTL ? 'إيرادات الفترة' : 'Period Revenue', value: fmt(Number(kpis.period_revenue || 0)), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ══════════════════ SALES ══════════════════ */}
        {activeSection === 'sales' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Pipeline Funnel */}
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  {isRTL ? 'مسار المبيعات (قمع)' : 'Sales Pipeline Funnel'}
                </h2>
                <div className="space-y-2.5">
                  {(salesFunnel as Array<{stage: string; count: number; total_value: number; weighted_value: number}>).map((item, i) => (
                    <div key={item.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[item.stage] || COLORS[i % COLORS.length] }} />
                          <span className="font-medium text-gray-700 capitalize">{item.stage}</span>
                          <span className="text-gray-400">({item.count})</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-500">
                          <span>{fmt(Number(item.total_value))}</span>
                          <span className="font-semibold text-gray-700 w-12 text-end">
                            {Math.max((item.count / Math.max(...(salesFunnel as Array<{count: number}>).map(f => f.count), 1)) * 100, 0).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-5 rounded-full flex items-center justify-end px-2 transition-all"
                          style={{
                            width: `${Math.max((item.count / Math.max(...(salesFunnel as Array<{count: number}>).map(f => f.count), 1)) * 100, 5)}%`,
                            background: STAGE_COLORS[item.stage] || COLORS[i % COLORS.length],
                          }}
                        >
                          <span className="text-white text-xs font-bold">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {salesFunnel.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{isRTL ? 'لا توجد بيانات' : 'No pipeline data'}</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <Link href="/sales/workspace" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    {isRTL ? 'فتح مسار المبيعات' : 'Open Pipeline'} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </Card>

              {/* Top Customers by Revenue */}
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  {isRTL ? 'أفضل العملاء (الربحية)' : 'Top Customers by Profit'}
                </h2>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {(profitability as Array<{id: string; company_name: string; total_revenue: number; total_costs: number; profit: number; profit_margin: number}>).slice(0, 8).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      >
                        {(c.company_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-800 truncate">{c.company_name}</p>
                          <span className={`text-xs font-bold ms-2 flex-shrink-0 ${Number(c.profit) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(Number(c.profit))}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${Number(c.profit_margin) >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(Math.max(Number(c.profit_margin), 0), 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{Number(c.profit_margin).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {profitability.length === 0 && (
                    <p className="text-center text-gray-400 py-6 text-sm">{isRTL ? 'لا توجد بيانات' : 'No data available'}</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══════════════════ OPERATIONS ══════════════════ */}
        {activeSection === 'operations' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Shipment Volume Trend */}
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  {isRTL ? 'اتجاه حجم الشحنات' : 'Shipment Volume Trend'}
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={shipmentData?.monthlyTrend as unknown[] || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name={isRTL ? 'إجمالي' : 'Total'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="delayed" name={isRTL ? 'متأخرة' : 'Delayed'} fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 flex justify-end">
                  <Link href="/shipments" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    {isRTL ? 'عرض الشحنات' : 'View Shipments'} <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </Card>

              {/* Shipments by Mode (Pie) */}
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Ship className="w-5 h-5 text-blue-500" />
                  {isRTL ? 'الشحنات حسب الوسيلة' : 'Shipments by Mode'}
                </h2>
                <div className="flex items-center">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie
                        data={shipmentData?.byMode as unknown[] || []}
                        dataKey="count"
                        nameKey="shipping_mode"
                        cx="50%" cy="50%"
                        innerRadius={35}
                        outerRadius={70}
                      >
                        {(shipmentData?.byMode as Array<{shipping_mode: string}> || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2 ps-4">
                    {(shipmentData?.byMode as Array<{shipping_mode: string; count: number}> || []).map((item, i) => (
                      <div key={item.shipping_mode} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="capitalize flex-1 text-gray-600 text-xs truncate">{item.shipping_mode || 'Unknown'}</span>
                        <span className="font-semibold text-gray-900 text-xs">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Shipments by Status */}
            <Card>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-violet-500" />
                {isRTL ? 'توزيع حالات الشحنات' : 'Shipment Status Distribution'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(shipmentData?.byStatus as Array<{status: string; count: number}> || []).map(item => (
                  <div key={item.status} className="rounded-xl border p-3 text-center" style={{ borderColor: SHIPMENT_COLORS[item.status] + '40', background: SHIPMENT_COLORS[item.status] + '10' }}>
                    <div className="text-xl font-bold" style={{ color: SHIPMENT_COLORS[item.status] || '#64748b' }}>{item.count}</div>
                    <div className="text-xs text-gray-500 mt-0.5 capitalize">{item.status.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Operational KPIs */}
            <Card>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                {isRTL ? 'مؤشرات الأداء التشغيلية' : 'Operational KPIs (30 days)'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: isRTL ? 'شحنات جديدة' : 'New Shipments', value: kpis.new_shipments || 0, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: isRTL ? 'متأخرة الآن' : 'Active Delayed', value: kpis.current_delayed || 0, icon: AlertTriangle, color: `${(kpis.current_delayed || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`, bg: `${(kpis.current_delayed || 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}` },
                  { label: isRTL ? 'تذاكر مفتوحة' : 'Open Tickets', value: kpis.new_tickets || 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: isRTL ? 'تذاكر محلولة' : 'Resolved', value: kpis.resolved_tickets || 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-4 flex items-start gap-3`}>
                    <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} />
                    <div>
                      <div className={`text-xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ══════════════════ FINANCE ══════════════════ */}
        {activeSection === 'finance' && (
          <div className="space-y-6">
            {/* Finance Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                  <span className="text-xs text-blue-500 bg-blue-200/50 px-2 py-0.5 rounded-full">{isRTL ? 'المجموع' : 'Total'}</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">{fmt(totalInv)}</div>
                <div className="text-sm text-blue-600 mt-1">{isRTL ? 'إجمالي الفواتير الصادرة' : 'Total Invoiced'}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <span className="text-xs text-emerald-600 bg-emerald-200/50 px-2 py-0.5 rounded-full">{collectionRate}% {isRTL ? 'محصَّل' : 'collected'}</span>
                </div>
                <div className="text-2xl font-bold text-emerald-700">{fmt(totalCol)}</div>
                <div className="text-sm text-emerald-600 mt-1">{isRTL ? 'إجمالي المحصَّل' : 'Total Collected'}</div>
              </div>
              <div className={`bg-gradient-to-br border rounded-xl p-5 ${totalOut > 0 ? 'from-orange-50 to-orange-100 border-orange-200' : 'from-gray-50 to-gray-100 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <AlertTriangle className={`w-6 h-6 ${totalOut > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
                  {totalOut > 0 && <span className="text-xs text-orange-600 bg-orange-200/50 px-2 py-0.5 rounded-full">{isRTL ? 'يحتاج متابعة' : 'Follow up'}</span>}
                </div>
                <div className={`text-2xl font-bold ${totalOut > 0 ? 'text-orange-700' : 'text-gray-400'}`}>{fmt(Math.max(totalOut, 0))}</div>
                <div className={`text-sm mt-1 ${totalOut > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{isRTL ? 'الرصيد المستحق' : 'Outstanding Balance'}</div>
              </div>
            </div>

            {/* Revenue chart (detailed) */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  {isRTL ? 'تفاصيل الإيرادات شهرياً' : 'Monthly Revenue Details'}
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueData as unknown[]}>
                  <defs>
                    {['inv2', 'col2', 'out2'].map((id, i) => (
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={50} />
                  <Tooltip formatter={(v) => fmt(Number(v ?? 0))} />
                  <Legend />
                  <Area type="monotone" dataKey="invoiced" name={isRTL ? 'فواتير' : 'Invoiced'} stroke={COLORS[0]} fill="url(#inv2)" strokeWidth={2} />
                  <Area type="monotone" dataKey="collected" name={isRTL ? 'محصَّل' : 'Collected'} stroke={COLORS[1]} fill="url(#col2)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outstanding" name={isRTL ? 'مستحق' : 'Outstanding'} stroke={COLORS[2]} fill="url(#out2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/finance" className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{isRTL ? 'إدارة الفواتير' : 'Manage Invoices'}</div>
                  <div className="text-xs text-gray-500">{isRTL ? 'عرض وإدارة جميع الفواتير' : 'View and manage all invoices'}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
              </Link>
              <Link href="/customers" className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{isRTL ? 'ربحية العملاء' : 'Customer Profitability'}</div>
                  <div className="text-xs text-gray-500">{isRTL ? 'تتبع ربحية كل عميل' : 'Track profitability per customer'}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600" />
              </Link>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
