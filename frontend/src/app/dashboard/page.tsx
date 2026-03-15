'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { dashboardAPI, salesAPI } from '@/lib/api';
import { DashboardStats } from '@/types';
import { StatCard, Card, Loading, Badge } from '@/components/ui';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import { useTranslation } from '@/lib/i18n';
import {
  Package, Users, TrendingUp, DollarSign, AlertTriangle,
  Ticket, Clock, Activity, ArrowRight, CheckCircle,
  Target, Award, UserCheck, BarChart2, RefreshCw,
  ChevronUp, ChevronDown, Minus, Star, Briefcase,
  Calendar, CheckSquare
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  booking: '#6366f1', pickup: '#8b5cf6', customs_export: '#f59e0b',
  departed: '#3b82f6', in_transit: '#06b6d4', customs_import: '#f97316',
  arrived: '#84cc16', delivered: '#10b981', cancelled: '#ef4444',
};

const STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8', contacted: '#3b82f6', rfq: '#8b5cf6',
  quotation: '#f59e0b', negotiation: '#f97316', won: '#10b981', lost: '#ef4444',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  sales: 'bg-blue-100 text-blue-700',
  operations: 'bg-green-100 text-green-700',
  finance: 'bg-purple-100 text-purple-700',
  support: 'bg-orange-100 text-orange-700',
};

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  last_login: string | null;
  is_active: boolean;
  deals_created: number;
  deals_won: number;
  deals_lost: number;
  deals_active: number;
  revenue_won: number;
  pipeline_weighted: number;
  tasks_created: number;
  tasks_completed: number;
  tasks_overdue: number;
  activity_count: number;
  customers_added: number;
}

interface TopDeal {
  id: string;
  deal_number: string;
  title: string;
  stage: string;
  value: number;
  currency: string;
  probability: number;
  expected_close_date: string;
  customer_name: string;
  assigned_to_name: string;
  shipping_mode: string;
  origin_country: string;
  destination_country: string;
}

interface SalesPerformance {
  teamStats: TeamMember[];
  topDeals: TopDeal[];
  activitySummary: Array<{ entity_type: string; count: number; day: string }>;
  conversionRates: Array<{ stage: string; count: number; total_value: number; avg_probability: number }>;
  period: number;
}

interface PersonalStats {
  deals: {
    active_deals: number;
    deals_won: number;
    deals_lost: number;
    revenue_won: number;
    pipeline_weighted: number;
    pipeline_value: number;
  };
  leads: {
    total_leads: number;
    new_leads: number;
    contacted_leads: number;
    qualified_leads: number;
    converted_leads: number;
  };
  tasks: {
    pending_tasks: number;
    in_progress_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
  };
  customers: {
    my_customers: number;
  };
  recentDeals: TopDeal[];
  recentActivities: Array<{ id: string; action: string; description: string; created_at: string }>;
  period: number;
}

type Period = '7' | '30' | '90';

export default function DashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isSales = user?.role?.toLowerCase() === 'sales';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<unknown[]>([]);
  const [shipmentData, setShipmentData] = useState<{ byStatus: unknown[]; byMode: unknown[] } | null>(null);
  const [salesFunnel, setSalesFunnel] = useState<unknown[]>([]);
  const [salesPerf, setSalesPerf] = useState<SalesPerformance | null>(null);
  const [myPerf, setMyPerf] = useState<TeamMember | null>(null);
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30');
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'pipeline'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const promises: Promise<unknown>[] = [
          dashboardAPI.getStats(),
          dashboardAPI.getRevenueChart({ period: 6 }),
          dashboardAPI.getShipmentChart(),
          dashboardAPI.getSalesFunnel(),
          dashboardAPI.getSalesTeamPerformance({ period }),
        ];
        const results = await Promise.all(promises) as Array<{ data: { data: unknown } }>;
        setStats(results[0].data.data as DashboardStats);
        setRevenueData(results[1].data.data as unknown[]);
        setShipmentData(results[2].data.data as { byStatus: unknown[]; byMode: unknown[] });
        setSalesFunnel(results[3].data.data as unknown[]);
        if (results[4]) {
          const perfData = results[4].data.data as SalesPerformance;
          setSalesPerf(perfData);
        }
      } else if (isSales) {
        const [statsRes, personalRes] = await Promise.all([
          dashboardAPI.getStats(),
          salesAPI.getMyStats({ period }),
        ]);
        setStats(statsRes.data.data as DashboardStats);
        setPersonalStats(personalRes.data.data as PersonalStats);
      } else {
        const [statsRes, revenueRes, shipmentRes] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getRevenueChart({ period: 6 }),
          dashboardAPI.getShipmentChart(),
        ]);
        setStats(statsRes.data.data as DashboardStats);
        setRevenueData(revenueRes.data.data as unknown[]);
        setShipmentData(shipmentRes.data.data as { byStatus: unknown[]; byMode: unknown[] });
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isSales, period, user?.id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace('/login'); return; }
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, authLoading, router, fetchData]);

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="p-8"><Loading text={t('common.loading')} /></div>
      </MainLayout>
    );
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);

  const pct = (won: number, total: number) =>
    total > 0 ? Math.round((won / total) * 100) : 0;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const taskCompletionRate = (m: TeamMember) =>
    pct(m.tasks_completed, m.tasks_created);

  const winRate = (m: TeamMember) =>
    pct(m.deals_won, m.deals_won + m.deals_lost || 1);

  const periodLabel = (p: Period) => {
    if (p === '7') return t('dashboard.period7');
    if (p === '30') return t('dashboard.period30');
    return t('dashboard.period90');
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
              {isAdmin ? t('dashboard.adminTitle') : isSales ? t('dashboard.salesTitle') : t('dashboard.operationsTitle')}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              <Calendar className="w-3.5 h-3.5 inline-block me-1" />
              {format(new Date(), 'EEEE, MMMM do yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
                {(['7', '30', '90'] as Period[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${period === p ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {periodLabel(p)}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.refresh')}</span>
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* All roles see Shipments */}
            <StatCard
              title={t('dashboard.activeShipments')}
              value={stats.shipments.active}
              icon={<Package className="w-6 h-6" />}
              subtitle={`${stats.shipments.delayed} ${t('shipments.statuses.delayed').toLowerCase()}`}
              color="blue"
            />
            {/* Admin/Finance see Revenue */}
            {!isSales ? (
              <StatCard
                title={t('dashboard.totalRevenue')}
                value={fmt(stats.revenue.total_invoiced)}
                icon={<DollarSign className="w-6 h-6" />}
                subtitle={`${fmt(stats.revenue.total_outstanding)} outstanding`}
                color="green"
              />
            ) : (
              <StatCard
                title={t('dashboard.activeDeals')}
                value={personalStats?.deals.active_deals ?? '—'}
                icon={<Briefcase className="w-6 h-6" />}
                subtitle={`${personalStats?.deals.deals_won ?? 0} ${t('dashboard.dealsWon').toLowerCase()}`}
                color="green"
              />
            )}
            {/* Non-sales see Tickets, sales see My Pipeline */}
            {!isSales ? (
              <StatCard
                title={t('dashboard.openTickets')}
                value={stats.tickets.open_count}
                icon={<Ticket className="w-6 h-6" />}
                subtitle={`${stats.tickets.critical} critical`}
                color="red"
              />
            ) : (
              <StatCard
                title={t('dashboard.myPipeline')}
                value={fmt(Number(personalStats?.deals.pipeline_value ?? 0))}
                icon={<TrendingUp className="w-6 h-6" />}
                subtitle={`Weighted: ${fmt(Number(personalStats?.deals.pipeline_weighted ?? 0))}`}
                color="purple"
              />
            )}
            {/* Admin/Ops see Pipeline Value, sales see My Leads */}
            {!isSales ? (
              <StatCard
                title={t('dashboard.pipelineValue')}
                value={fmt(stats.sales.weighted_pipeline)}
                icon={<TrendingUp className="w-6 h-6" />}
                subtitle={`${stats.sales.active} active deals`}
                color="purple"
              />
            ) : (
              <StatCard
                title={t('dashboard.myLeads')}
                value={personalStats?.leads.total_leads ?? '—'}
                icon={<Users className="w-6 h-6" />}
                subtitle={`${personalStats?.leads.new_leads ?? 0} new, ${personalStats?.leads.qualified_leads ?? 0} qualified`}
                color="blue"
              />
            )}
          </div>
        )}

        {/* ── Admin Tabs ── */}
        {isAdmin && (
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
            {([
              { id: 'overview', label: t('dashboard.overview'), icon: BarChart2 },
              { id: 'team', label: t('dashboard.teamPerformance'), icon: Users },
              { id: 'pipeline', label: t('dashboard.pipeline'), icon: Target },
            ] as { id: typeof activeTab; label: string; icon: React.ElementType }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <tab.icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            OVERVIEW TAB
        ═══════════════════════════════════════════ */}
        {(!isAdmin || activeTab === 'overview') && (
          <>
            {/* Charts Row - only for non-sales (or admin) */}
            {!isSales && (
            <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <AIInsightsPanel />
              {/* Admin: Command Center — Operational Health */}
              {isAdmin ? (
              <Card className="col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      {isRTL ? 'مركز قيادة العمليات' : 'Operations Command Center'}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{isRTL ? 'نظرة فورية على حالة الأعمال — المشكلات التي تحتاج تدخلاً' : 'Real-time business health — items requiring attention'}</p>
                  </div>
                  <span className="text-xs text-gray-500 bg-blue-50 text-blue-600 px-2 py-1 rounded-full whitespace-nowrap ms-2 flex-shrink-0">{isRTL ? 'الحالة الآن' : 'Live Status'}</span>
                </div>
                {/* 2×3 KPI Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className={`rounded-xl p-3 ${(stats?.shipments?.delayed || 0) > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <Package className={`w-4 h-4 ${(stats?.shipments?.delayed || 0) > 0 ? 'text-orange-500' : 'text-green-500'}`} />
                      {(stats?.shipments?.delayed || 0) > 0 && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">!</span>}
                    </div>
                    <div className={`text-xl font-bold kpi-number ${(stats?.shipments?.delayed || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>{stats?.shipments?.delayed || 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{isRTL ? 'شحنات متأخرة' : 'Delayed Shipments'}</div>
                  </div>
                  <div className={`rounded-xl p-3 ${(stats?.revenue?.overdue_count || 0) > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <DollarSign className={`w-4 h-4 ${(stats?.revenue?.overdue_count || 0) > 0 ? 'text-red-500' : 'text-green-500'}`} />
                      {(stats?.revenue?.overdue_count || 0) > 0 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">!</span>}
                    </div>
                    <div className={`text-xl font-bold kpi-number ${(stats?.revenue?.overdue_count || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats?.revenue?.overdue_count || 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{isRTL ? 'فواتير متأخرة' : 'Overdue Invoices'}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <TrendingUp className="w-4 h-4 text-blue-500 mb-1" />
                    <div className="text-xl font-bold text-blue-600 kpi-number">{stats?.sales?.active || 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{isRTL ? 'صفقات نشطة' : 'Active Deals'}</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                    <Users className="w-4 h-4 text-purple-500 mb-1" />
                    <div className="text-xl font-bold text-purple-600 kpi-number">{stats?.sales?.won || 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{isRTL ? 'صفقات مُغلقة (مربوحة)' : 'Deals Won'}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <Award className="w-4 h-4 text-emerald-500 mb-1" />
                    <div className="text-xl font-bold text-emerald-600 kpi-number">{fmt(Number(stats?.revenue?.total_paid || 0))}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{isRTL ? 'إجمالي المحصَّل' : 'Total Collected'}</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <Target className="w-4 h-4 text-yellow-500 mb-1" />
                    <div className="text-xl font-bold text-yellow-600 kpi-number">{fmt(Number(stats?.revenue?.total_outstanding || 0))}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{isRTL ? 'مستحق (غير محصَّل)' : 'Outstanding Balance'}</div>
                  </div>
                </div>
                {/* Action items */}
                <div className="space-y-2">
                  {(stats?.shipments?.delayed || 0) > 0 && (
                    <Link href="/shipments?status=delayed" className="flex items-center gap-3 p-2.5 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 animate-pulse" />
                      <span className="text-xs text-orange-700 font-medium flex-1">{stats?.shipments?.delayed} {isRTL ? 'شحنة متأخرة تحتاج مراجعة' : 'delayed shipments need review'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
                    </Link>
                  )}
                  {(stats?.revenue?.overdue_count || 0) > 0 && (
                    <Link href="/finance" className="flex items-center gap-3 p-2.5 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 animate-pulse" />
                      <span className="text-xs text-red-700 font-medium flex-1">{stats?.revenue?.overdue_count} {isRTL ? 'فاتورة متأخرة — اتخاذ إجراء' : 'overdue invoices — action required'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-red-400" />
                    </Link>
                  )}
                  {(stats?.sales?.active || 0) > 0 && (
                    <Link href="/sales/workspace" className="flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-xs text-blue-700 font-medium flex-1">{stats?.sales?.active} {isRTL ? 'صفقة نشطة في مسار المبيعات' : 'active deals in pipeline — track progress'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                    </Link>
                  )}
                  {(stats?.shipments?.active || 0) > 0 && (
                    <Link href="/shipments" className="flex items-center gap-3 p-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600 flex-1">{stats?.shipments?.active} {isRTL ? 'شحنة جارية' : 'active shipments in transit'}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    </Link>
                  )}
                </div>
              </Card>
              ) : (
              <Card className="col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-gray-900 text-sm sm:text-base">{t('dashboard.revenueOverview')}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isRTL ? 'الفواتير الصادرة مقابل المبالغ المحصَّلة — آخر 6 أشهر' : 'Total invoiced vs. payments collected — last 6 months'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap ms-2 flex-shrink-0">{t('dashboard.last6Months')}</span>
                </div>
                {/* Mini legend */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-gray-600">{isRTL ? 'إجمالي الفواتير' : 'Invoiced (billed to client)'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-gray-600">{isRTL ? 'مبالغ محصَّلة' : 'Collected (payments received)'}</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={revenueData as unknown[]}>
                    <defs>
                      <linearGradient id="invoiced" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
                    <Tooltip
                      formatter={(v, name) => [fmt(Number(v ?? 0)), name === 'invoiced' ? (isRTL ? 'إجمالي الفواتير' : 'Invoiced') : (isRTL ? 'المحصَّل' : 'Collected')]}
                      labelFormatter={(label) => `${isRTL ? 'الشهر:' : 'Month:'} ${label}`}
                    />
                    <Area type="monotone" dataKey="invoiced" name={isRTL ? 'الفواتير' : 'Invoiced'} stroke="#3b82f6" fill="url(#invoiced)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="collected" name={isRTL ? 'المحصَّل' : 'Collected'} stroke="#10b981" fill="url(#collected)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Revenue summary totals */}
                {(revenueData as Array<{invoiced?: number; collected?: number}>).length > 0 && (() => {
                  const rd = revenueData as Array<{invoiced?: number; collected?: number}>;
                  const totalInv = rd.reduce((s, r) => s + Number(r.invoiced || 0), 0);
                  const totalCol = rd.reduce((s, r) => s + Number(r.collected || 0), 0);
                  const gap = totalInv - totalCol;
                  const pct = totalInv > 0 ? Math.round((totalCol / totalInv) * 100) : 0;
                  return (
                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">{isRTL ? 'إجمالي الفواتير' : 'Total Invoiced'}</p>
                        <p className="text-sm font-bold text-blue-600 ltr-num">{fmt(totalInv)}</p>
                        <p className="text-xs text-gray-400">{isRTL ? '(ما تم إصداره للعملاء)' : '(billed to clients)'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">{isRTL ? 'إجمالي المحصَّل' : 'Total Collected'}</p>
                        <p className="text-sm font-bold text-emerald-600 ltr-num">{fmt(totalCol)}</p>
                        <p className="text-xs text-gray-400 ltr-num">{pct}% {isRTL ? 'نسبة التحصيل' : 'collection rate'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">{isRTL ? 'رصيد مستحق' : 'Outstanding'}</p>
                        <p className={`text-sm font-bold ltr-num ${gap > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{fmt(Math.max(gap, 0))}</p>
                        <p className="text-xs text-gray-400">{isRTL ? '(غير مسدَّد بعد)' : '(not yet collected)'}</p>
                      </div>
                    </div>
                  );
                })()}
              </Card>
              )}

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{t('dashboard.shipmentsByStatus')}</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={shipmentData?.byStatus as unknown[] || []} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                        {(shipmentData?.byStatus as Array<{ status: string }> || []).map((entry, idx) => (
                          <Cell key={idx} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => v as number} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col justify-center gap-1.5">
                    {(shipmentData?.byStatus as Array<{ status: string; count: number }> || []).slice(0, 6).map(item => (
                      <div key={item.status} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[item.status] || '#94a3b8' }} />
                        <span className="text-gray-600 capitalize flex-1 truncate">{item.status.replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-gray-800">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4 text-sm sm:text-base truncate">{t('dashboard.salesPipeline')}</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={salesFunnel as unknown[]} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="stage" type="category" tick={{ fontSize: 10 }} width={65} />
                    <Tooltip formatter={(v) => [v as number, t('dashboard.stageDeals')]} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Delayed Shipments */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                    <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <span className="truncate">{t('dashboard.delayedShipments')}</span>
                  </h2>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full flex-shrink-0">{stats?.shipments.delayed || 0}</span>
                </div>
                <div className="space-y-2">
                  {stats?.delayedShipments && stats.delayedShipments.length > 0 ? (
                    stats.delayedShipments.map((s) => (
                      <div key={(s as { id?: string }).id} className="p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800 truncate">{(s as { reference_number?: string }).reference_number}</span>
                          <Badge variant="warning">{t('shipments.statuses.delayed')}</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{(s as { customer_name?: string }).customer_name}</p>
                        <p className="text-xs text-gray-400 truncate">{(s as { origin_country?: string }).origin_country} → {(s as { destination_country?: string }).destination_country}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm text-gray-500">{t('dashboard.noDelayedShipments')}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Overdue Invoices */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                    <Clock className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="truncate">{t('dashboard.overdueInvoices')}</span>
                  </h2>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full flex-shrink-0">{stats?.revenue.overdue_count || 0}</span>
                </div>
                <div className="space-y-2">
                  {stats?.overdueInvoices && stats.overdueInvoices.length > 0 ? (
                    stats.overdueInvoices.map((inv, i) => (
                      <div key={i} className="p-2.5 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800 truncate">{(inv as { invoice_number?: string }).invoice_number}</span>
                          <span className="text-xs font-bold text-red-600 flex-shrink-0 ms-1">${Number((inv as { outstanding_amount?: number }).outstanding_amount || 0).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{(inv as { customer_name?: string }).customer_name}</p>
                        <p className="text-xs text-gray-400">{(inv as { due_date?: string }).due_date ? format(new Date((inv as { due_date: string }).due_date), 'MMM d, yyyy') : 'N/A'}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm text-gray-500">{t('dashboard.noOverdueInvoices')}</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
            </>
            )} {/* End !isSales charts */}

            {/* Quick Links - role-based */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('dashboard.quickLinks')}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(isSales ? [
                  { label: t('dashboard.myLeads'), href: '/sales/my-leads', color: 'bg-blue-600 hover:bg-blue-700 text-white', icon: <TrendingUp className="w-5 h-5" /> },
                  { label: t('dashboard.myPipeline'), href: '/sales/workspace', color: 'bg-emerald-600 hover:bg-emerald-700 text-white', icon: <Briefcase className="w-5 h-5" /> },
                  { label: t('dashboard.myCustomers'), href: '/customers', color: 'bg-orange-500 hover:bg-orange-600 text-white', icon: <Users className="w-5 h-5" /> },
                  { label: isRTL ? 'طلبات الأسعار' : 'My RFQs', href: '/rfqs', color: 'bg-purple-600 hover:bg-purple-700 text-white', icon: <Target className="w-5 h-5" /> },
                ] : isAdmin ? [
                  { label: isRTL ? 'إدارة الموظفين' : 'Manage Users', href: '/admin/users', color: 'bg-blue-600 hover:bg-blue-700 text-white', icon: <Users className="w-5 h-5" /> },
                  { label: isRTL ? 'قاعدة العملاء المحتملين' : 'Lead Database', href: '/admin/leads', color: 'bg-violet-600 hover:bg-violet-700 text-white', icon: <Target className="w-5 h-5" /> },
                  { label: isRTL ? 'الشحنات المتأخرة' : 'Delayed Shipments', href: '/shipments?status=delayed', color: 'bg-orange-500 hover:bg-orange-600 text-white', icon: <Package className="w-5 h-5" /> },
                  { label: isRTL ? 'التقارير' : 'Reports', href: '/reports', color: 'bg-emerald-600 hover:bg-emerald-700 text-white', icon: <BarChart2 className="w-5 h-5" /> },
                ] : [
                  { label: t('dashboard.newShipment'), href: '/shipments', color: 'bg-blue-600 hover:bg-blue-700 text-white', icon: <Package className="w-5 h-5" /> },
                  { label: t('dashboard.myDeals'), href: '/sales', color: 'bg-emerald-600 hover:bg-emerald-700 text-white', icon: <Briefcase className="w-5 h-5" /> },
                  { label: t('dashboard.newTicket'), href: '/tickets', color: 'bg-orange-500 hover:bg-orange-600 text-white', icon: <Ticket className="w-5 h-5" /> },
                  { label: t('dashboard.myTasks'), href: '/tasks', color: 'bg-purple-600 hover:bg-purple-700 text-white', icon: <CheckSquare className="w-5 h-5" /> },
                ]).map(({ label, href, color, icon }) => (
                  <Link key={href} href={href} className={`${color} rounded-xl p-3 sm:p-4 flex items-center justify-between group transition-colors`}>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="flex-shrink-0">{icon}</span>
                      <span className="font-medium text-xs sm:text-sm truncate">{label}</span>
                    </div>
                    <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                  </Link>
                ))}
              </div>
            </div>

            {/* My Performance (for non-admin sales reps) */}
            {isSales && personalStats && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 sm:p-6 text-white">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold">{t('dashboard.myPerformance')}</h2>
                    <p className="text-blue-200 text-xs sm:text-sm">{isRTL ? `آخر ${period} يوماً` : `Last ${period} days`}</p>
                  </div>
                  <div className="flex bg-blue-800/50 rounded-lg p-0.5 text-sm">
                    {(['7', '30', '90'] as Period[]).map(p => (
                      <button key={p} onClick={() => setPeriod(p)} className={`px-2.5 sm:px-3 py-1.5 rounded-md font-medium transition-all text-xs sm:text-sm ${period === p ? 'bg-white text-blue-600 shadow' : 'text-blue-200 hover:text-white'}`}>
                        {periodLabel(p)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl sm:text-2xl font-bold kpi-number">{personalStats.deals.active_deals}</div>
                    <div className="text-blue-200 text-xs mt-1 leading-tight">{t('dashboard.activeDeals')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl sm:text-2xl font-bold kpi-number">{personalStats.deals.deals_won}</div>
                    <div className="text-blue-200 text-xs mt-1 leading-tight">{t('dashboard.dealsWon')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl sm:text-2xl font-bold kpi-number">{fmt(Number(personalStats.deals.revenue_won))}</div>
                    <div className="text-blue-200 text-xs mt-1 leading-tight">{t('dashboard.revenueWon')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl sm:text-2xl font-bold kpi-number">
                      {personalStats.tasks.completed_tasks}/{personalStats.tasks.completed_tasks + personalStats.tasks.pending_tasks + personalStats.tasks.in_progress_tasks}
                    </div>
                    <div className="text-blue-200 text-xs mt-1 leading-tight">{t('dashboard.tasksDone')}</div>
                  </div>
                </div>

                {/* Leads & Customers Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-lg sm:text-xl font-bold kpi-number">{personalStats.leads.total_leads}</div>
                    <div className="text-blue-200 text-xs mt-1 leading-tight">{t('dashboard.myLeads')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-lg sm:text-xl font-bold kpi-number">{personalStats.leads.new_leads}</div>
                    <div className="text-blue-200 text-xs mt-1 leading-tight">{isRTL ? 'عملاء جدد' : 'New Leads'}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-lg sm:text-xl font-bold kpi-number">{personalStats.customers.my_customers}</div>
                    <div className="text-blue-200 text-xs mt-1 leading-tight">{t('dashboard.myCustomers')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-lg sm:text-xl font-bold text-orange-300 kpi-number">{personalStats.tasks.overdue_tasks}</div>
                    <div className="text-blue-200 text-xs mt-1 leading-tight">{isRTL ? 'مهام متأخرة' : 'Overdue Tasks'}</div>
                  </div>
                </div>

                {/* Progress bars */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="flex justify-between text-xs text-blue-200 mb-1">
                      <span>{t('dashboard.winRate')}</span>
                      <span className="kpi-number">{pct(personalStats.deals.deals_won, personalStats.deals.deals_won + personalStats.deals.deals_lost || 1)}%</span>
                    </div>
                    <div className="h-2 bg-blue-800/60 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct(personalStats.deals.deals_won, personalStats.deals.deals_won + personalStats.deals.deals_lost || 1)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-blue-200 mb-1">
                      <span>{t('dashboard.taskCompletion')}</span>
                      <span className="kpi-number">{pct(personalStats.tasks.completed_tasks, (personalStats.tasks.completed_tasks + personalStats.tasks.pending_tasks + personalStats.tasks.in_progress_tasks) || 1)}%</span>
                    </div>
                    <div className="h-2 bg-blue-800/60 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${pct(personalStats.tasks.completed_tasks, (personalStats.tasks.completed_tasks + personalStats.tasks.pending_tasks + personalStats.tasks.in_progress_tasks) || 1)}%` }} />
                    </div>
                  </div>
                </div>

                {personalStats.tasks.overdue_tasks > 0 && (
                  <div className="mt-2 mb-3 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
                    <AlertTriangle className="w-4 h-4 text-red-300 flex-shrink-0" />
                    <span className="text-sm text-red-200">{personalStats.tasks.overdue_tasks} {t('dashboard.overdueTasksAlert')}</span>
                    <Link href="/tasks" className="text-white underline text-sm font-medium">{isRTL ? 'عرض الآن' : 'View Now'}</Link>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Link href="/tasks" className="flex-1 min-w-[120px] bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-center transition-colors flex items-center justify-center gap-2">
                    <CheckSquare className="w-4 h-4" />{t('dashboard.myTasks')}
                  </Link>
                  <Link href="/rfqs" className="flex-1 min-w-[120px] bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium text-center transition-colors flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" />{isRTL ? 'طلبات الأسعار' : 'My RFQs'}
                  </Link>
                </div>
              </div>
            )}
            {/* Legacy myPerf fallback for non-sales non-admin users */}
            {!isAdmin && !isSales && myPerf && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 sm:p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold">{t('dashboard.myPerformance')}</h2>
                    <p className="text-blue-200 text-xs sm:text-sm">{isRTL ? `آخر ${period} يوماً` : `Last ${period} days`}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl sm:text-2xl font-bold kpi-number">{myPerf.deals_active}</div>
                    <div className="text-blue-200 text-xs mt-1">{t('dashboard.activeDeals')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl sm:text-2xl font-bold kpi-number">{myPerf.deals_won}</div>
                    <div className="text-blue-200 text-xs mt-1">{t('dashboard.dealsWon')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl sm:text-2xl font-bold kpi-number">{fmt(myPerf.revenue_won)}</div>
                    <div className="text-blue-200 text-xs mt-1">{t('dashboard.revenueWon')}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-xl sm:text-2xl font-bold kpi-number">{myPerf.tasks_completed}/{myPerf.tasks_created}</div>
                    <div className="text-blue-200 text-xs mt-1">{t('dashboard.tasksDone')}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════
            TEAM PERFORMANCE TAB (Admin only)
        ═══════════════════════════════════════════ */}
        {isAdmin && activeTab === 'team' && salesPerf && (
          <>
            {/* Summary Performance Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <UserCheck className="w-5 h-5 opacity-80" />
                  <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">last {period}d</span>
                </div>
                <div className="text-2xl font-bold kpi-number">{salesPerf.teamStats.filter(m => m.is_active).length}</div>
                <div className="text-xs opacity-80 mt-1 leading-tight">{t('dashboard.teamMembers')}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-5 h-5 opacity-80" />
                  <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">won</span>
                </div>
                <div className="text-2xl font-bold kpi-number">
                  {fmt(salesPerf.teamStats.reduce((a, m) => a + Number(m.revenue_won || 0), 0))}
                </div>
                <div className="text-xs opacity-80 mt-1 leading-tight">{t('dashboard.totalTeamRevenue')}</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-5 h-5 opacity-80" />
                </div>
                <div className="text-2xl font-bold kpi-number">
                  {salesPerf.teamStats.reduce((a, m) => a + Number(m.deals_won || 0), 0)}
                </div>
                <div className="text-xs opacity-80 mt-1 leading-tight">{t('dashboard.dealsWon')}</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <CheckSquare className="w-5 h-5 opacity-80" />
                </div>
                <div className="text-2xl font-bold kpi-number">
                  {salesPerf.teamStats.reduce((a, m) => a + Number(m.tasks_completed || 0), 0)}
                </div>
                <div className="text-xs opacity-80 mt-1 leading-tight">{t('dashboard.tasksDone')}</div>
              </div>
            </div>

            {/* Team Member Cards Grid */}
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2 flex-wrap">
                <Users className="w-5 h-5 text-blue-600" />
                {isRTL ? 'بطاقات أداء الموظفين' : 'Employee Performance Cards'}
                <span className="text-sm font-normal text-gray-500">— {periodLabel(period)}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {salesPerf.teamStats.map((member, idx) => {
                  const wr = winRate(member);
                  const tcr = taskCompletionRate(member);
                  return (
                    <div
                      key={member.id}
                      className={`bg-white rounded-xl border-2 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow ${member.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${['bg-blue-500','bg-emerald-500','bg-purple-500','bg-orange-500','bg-rose-500','bg-cyan-500'][idx % 6]}`}>
                            {getInitials(member.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm leading-tight truncate">{member.name}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[130px]">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[member.role?.toLowerCase()] || 'bg-gray-100 text-gray-700'}`}>
                            {member.role || 'user'}
                          </span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${member.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                            <span className="text-xs text-gray-400">
                              {member.last_login ? formatDistanceToNow(new Date(member.last_login), { addSuffix: true }) : 'never'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* KPI Stats Grid */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <div className="text-base sm:text-lg font-bold text-blue-600 kpi-number">{member.deals_active}</div>
                          <div className="text-xs text-gray-500 leading-tight">{t('dashboard.activeDeals')}</div>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2 text-center">
                          <div className="text-base sm:text-lg font-bold text-emerald-600 kpi-number">{member.deals_won}</div>
                          <div className="text-xs text-gray-500">{isRTL ? 'مربوح' : 'Won'}</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <div className="text-base sm:text-lg font-bold text-purple-600 kpi-number">{fmt(member.revenue_won)}</div>
                          <div className="text-xs text-gray-500">{isRTL ? 'إيرادات' : 'Revenue'}</div>
                        </div>
                      </div>

                      {/* Win Rate Bar */}
                      <div className="mb-2.5">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{t('dashboard.winRate')}</span>
                          <span className={`font-medium kpi-number ${wr >= 50 ? 'text-emerald-600' : wr >= 30 ? 'text-yellow-600' : 'text-red-500'}`}>{wr}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${wr >= 50 ? 'bg-emerald-500' : wr >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${wr}%` }}
                          />
                        </div>
                      </div>

                      {/* Task Completion Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{t('dashboard.taskCompletion')}</span>
                          <span className={`font-medium kpi-number ${tcr >= 70 ? 'text-emerald-600' : tcr >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>{tcr}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${tcr >= 70 ? 'bg-emerald-500' : tcr >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${tcr}%` }}
                          />
                        </div>
                      </div>

                      {/* Bottom Stats */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{member.activity_count}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />+{member.customers_added}</span>
                        </div>
                        {member.tasks_overdue > 0 ? (
                          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{member.tasks_overdue}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />{isRTL ? 'على المسار' : 'On track'}
                          </span>
                        )}
                      </div>

                      {/* Pipeline Value */}
                      <div className="mt-2.5 bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">{isRTL ? 'المسار المرجح' : 'Weighted Pipeline'}</span>
                        <span className="text-sm font-semibold text-gray-700 kpi-number">{fmt(member.pipeline_weighted)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leaderboard Table */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                  <Star className="w-5 h-5 text-yellow-500" />
                  {isRTL ? 'لوحة الصدارة' : 'Sales Leaderboard'}
                </h2>
                <span className="text-xs text-gray-500">{periodLabel(period)}</span>
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-start py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                      <th className="text-start py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{isRTL ? 'الموظف' : 'Employee'}</th>
                      <th className="text-end py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('dashboard.dealsWon')}</th>
                      <th className="text-end py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{isRTL ? 'الإيرادات' : 'Revenue'}</th>
                      <th className="text-end py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('dashboard.winRate')}</th>
                      <th className="text-end py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('dashboard.tasksDone')}</th>
                      <th className="text-end py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{isRTL ? 'الأنشطة' : 'Activities'}</th>
                      <th className="text-end py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{isRTL ? 'المسار' : 'Pipeline'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPerf.teamStats.map((member, idx) => {
                      const wr = winRate(member);
                      return (
                        <tr key={member.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-white' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                              {idx + 1}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${['bg-blue-500','bg-emerald-500','bg-purple-500','bg-orange-500','bg-rose-500','bg-cyan-500'][idx % 6]}`}>
                                {getInitials(member.name)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-800 text-sm">{member.name}</div>
                                <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${ROLE_COLORS[member.role?.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>{member.role}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-end">
                            <span className="font-semibold text-emerald-600 kpi-number">{member.deals_won}</span>
                            {member.deals_lost > 0 && <span className="text-xs text-gray-400 ms-1 kpi-number">/ {member.deals_lost}</span>}
                          </td>
                          <td className="py-3 px-3 text-end font-semibold text-gray-800 kpi-number">{fmt(member.revenue_won)}</td>
                          <td className="py-3 px-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <span className={`font-medium text-sm kpi-number ${wr >= 50 ? 'text-emerald-600' : wr >= 30 ? 'text-yellow-600' : 'text-red-500'}`}>{wr}%</span>
                              {wr >= 50 ? <ChevronUp className="w-3 h-3 text-emerald-500" /> : wr >= 30 ? <Minus className="w-3 h-3 text-yellow-500" /> : <ChevronDown className="w-3 h-3 text-red-500" />}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-end text-gray-700 kpi-number">{member.tasks_completed}<span className="text-gray-400 text-xs">/{member.tasks_created}</span></td>
                          <td className="py-3 px-3 text-end text-gray-700 kpi-number">{member.activity_count}</td>
                          <td className="py-3 px-3 text-end font-medium text-purple-600 kpi-number">{fmt(member.pipeline_weighted)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ═══════════════════════════════════════════
            PIPELINE TAB (Admin only)
        ═══════════════════════════════════════════ */}
        {isAdmin && activeTab === 'pipeline' && salesPerf && (
          <>
            {/* Pipeline by Stage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4 text-sm sm:text-base">{isRTL ? 'توزيع المراحل' : 'Stage Distribution'}</h2>
                <div className="space-y-3">
                  {salesPerf.conversionRates.map(stage => {
                    const totalDeals = salesPerf.conversionRates.reduce((a, s) => a + Number(s.count || 0), 0);
                    const stagePct = totalDeals > 0 ? Math.round((Number(stage.count) / totalDeals) * 100) : 0;
                    return (
                      <div key={stage.stage}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[stage.stage] || '#94a3b8' }} />
                            <span className="text-sm font-medium text-gray-700 capitalize truncate">{stage.stage}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">({stage.count} {t('dashboard.stageDeals')})</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0 ms-2">
                            <span className="kpi-number">{fmt(Number(stage.total_value))}</span>
                            <span className="font-semibold text-gray-700 kpi-number">{stagePct}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${stagePct}%`, background: STAGE_COLORS[stage.stage] || '#94a3b8' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <h2 className="font-semibold text-gray-900 mb-4 text-sm sm:text-base">{isRTL ? 'قيم المراحل' : 'Stage Values'}</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={salesPerf.conversionRates} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="total_value" name={isRTL ? 'إجمالي القيمة' : 'Total Value'} radius={[4, 4, 0, 0]}>
                      {salesPerf.conversionRates.map((entry) => (
                        <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] || '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Top Deals */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  {isRTL ? 'أفضل الصفقات النشطة' : 'Top Active Deals'}
                </h2>
                <Link href="/deals" className="text-sm text-blue-600 hover:underline flex items-center gap-1 flex-shrink-0">
                  {t('common.view')} <ArrowRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''}`} />
                </Link>
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-start py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('deals.dealNumber')}</th>
                      <th className="text-start py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('deals.customer')}</th>
                      <th className="text-start py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('deals.stage')}</th>
                      <th className="text-end py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('deals.value')}</th>
                      <th className="text-end py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('deals.probability')}</th>
                      <th className="text-start py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{isRTL ? 'المسار' : 'Route'}</th>
                      <th className="text-start py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('deals.assignedTo')}</th>
                      <th className="text-start py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('deals.expectedClose')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPerf.topDeals.map(deal => (
                      <tr key={deal.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-3">
                          <Link href={`/deals/${deal.id}`} className="text-blue-600 hover:underline font-medium">
                            {deal.deal_number}
                          </Link>
                          <div className="text-xs text-gray-500 truncate max-w-[140px]">{deal.title}</div>
                        </td>
                        <td className="py-3 px-3 text-gray-700 text-xs max-w-[120px] truncate">{deal.customer_name}</td>
                        <td className="py-3 px-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={{ background: STAGE_COLORS[deal.stage] + '20', color: STAGE_COLORS[deal.stage] }}>
                            {deal.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-end font-semibold text-gray-800 kpi-number">{fmt(deal.value)}</td>
                        <td className="py-3 px-3 text-end">
                          <span className={`text-xs font-medium kpi-number ${deal.probability >= 70 ? 'text-emerald-600' : deal.probability >= 40 ? 'text-yellow-600' : 'text-gray-500'}`}>
                            {deal.probability}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-600 max-w-[140px]">
                          {deal.origin_country && deal.destination_country ? `${deal.origin_country} → ${deal.destination_country}` : '—'}
                          {deal.shipping_mode && <span className="ms-1 capitalize text-gray-400">({deal.shipping_mode})</span>}
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-600 max-w-[100px] truncate">{deal.assigned_to_name || '—'}</td>
                        <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">
                          {deal.expected_close_date ? format(new Date(deal.expected_close_date), 'MMM d, yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                    {salesPerf.topDeals.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400 text-sm">{t('common.noData')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Team vs Pipeline Radar */}
            {salesPerf.teamStats.length > 0 && (
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4 text-sm sm:text-base">{isRTL ? 'رادار نشاط الفريق' : 'Team Activity Radar (Top 6)'}</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={salesPerf.teamStats.slice(0, 6).map(m => ({
                    name: m.name.split(' ')[0],
                    [isRTL ? 'صفقات نشطة' : 'Deals Active']: Number(m.deals_active),
                    [isRTL ? 'مربوح' : 'Won']: Number(m.deals_won),
                    [isRTL ? 'مهام منجزة' : 'Tasks Done']: Number(m.tasks_completed),
                    [isRTL ? 'أنشطة' : 'Activities']: Math.min(Number(m.activity_count), 50),
                    [isRTL ? 'عملاء' : 'Customers']: Number(m.customers_added),
                  }))}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fontSize: 9 }} />
                    <Radar name={isRTL ? 'صفقات نشطة' : 'Deals Active'} dataKey={isRTL ? 'صفقات نشطة' : 'Deals Active'} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                    <Radar name={isRTL ? 'مربوح' : 'Won'} dataKey={isRTL ? 'مربوح' : 'Won'} stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                    <Radar name={isRTL ? 'مهام منجزة' : 'Tasks Done'} dataKey={isRTL ? 'مهام منجزة' : 'Tasks Done'} stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </>
        )}

      </div>
    </MainLayout>
  );
}
