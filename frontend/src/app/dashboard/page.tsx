'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { dashboardAPI } from '@/lib/api';
import { DashboardStats } from '@/types';
import { StatCard, Card, Loading, Badge } from '@/components/ui';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import {
  Package, Users, TrendingUp, DollarSign, AlertTriangle,
  Ticket, Clock, Activity, ArrowRight, CheckCircle,
  Target, Award, UserCheck, BarChart2, RefreshCw,
  ChevronUp, ChevronDown, Minus, Star, Briefcase,
  Calendar, Phone, Mail, CheckSquare, Globe
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

type Period = '7' | '30' | '90';

export default function DashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const isSales = user?.role?.toLowerCase() === 'sales';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<unknown[]>([]);
  const [shipmentData, setShipmentData] = useState<{ byStatus: unknown[]; byMode: unknown[] } | null>(null);
  const [salesFunnel, setSalesFunnel] = useState<unknown[]>([]);
  const [salesPerf, setSalesPerf] = useState<SalesPerformance | null>(null);
  const [myPerf, setMyPerf] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30');
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'pipeline'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
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
        // Find current user's stats
        const me = perfData?.teamStats?.find((m: TeamMember) => m.id === user?.id);
        if (me) setMyPerf(me);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, period, user?.id]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace('/login'); return; }
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, authLoading, router, fetchData]);

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="p-8"><Loading text="Loading dashboard..." /></div>
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

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isAdmin ? 'Admin Dashboard' : isSales ? 'My Sales Dashboard' : 'Operations Dashboard'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM do yyyy')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
                {(['7', '30', '90'] as Period[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${period === p ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {p}d
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Active Shipments"
              value={stats.shipments.active}
              icon={<Package className="w-6 h-6" />}
              subtitle={`${stats.shipments.delayed} delayed`}
              color="blue"
            />
            <StatCard
              title="Total Revenue"
              value={fmt(stats.revenue.total_invoiced)}
              icon={<DollarSign className="w-6 h-6" />}
              subtitle={`${fmt(stats.revenue.total_outstanding)} outstanding`}
              color="green"
            />
            <StatCard
              title="Open Tickets"
              value={stats.tickets.open_count}
              icon={<Ticket className="w-6 h-6" />}
              subtitle={`${stats.tickets.critical} critical`}
              color="red"
            />
            <StatCard
              title="Pipeline Value"
              value={fmt(stats.sales.weighted_pipeline)}
              icon={<TrendingUp className="w-6 h-6" />}
              subtitle={`${stats.sales.active} active deals`}
              color="purple"
            />
          </div>
        )}

        {/* ── Admin Tabs ── */}
        {isAdmin && (
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {([
              { id: 'overview', label: 'Overview', icon: BarChart2 },
              { id: 'team', label: 'Team Performance', icon: Users },
              { id: 'pipeline', label: 'Pipeline', icon: Target },
            ] as { id: typeof activeTab; label: string; icon: React.ElementType }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            OVERVIEW TAB
        ═══════════════════════════════════════════ */}
        {(!isAdmin || activeTab === 'overview') && (
          <>
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AIInsightsPanel />
              <Card className="col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Revenue Overview</h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Last 6 months</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
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
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(Number(v ?? 0))} />
                    <Legend />
                    <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#3b82f6" fill="url(#invoiced)" strokeWidth={2} />
                    <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" fill="url(#collected)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Shipments by Status</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={shipmentData?.byStatus as unknown[] || []} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                        {(shipmentData?.byStatus as Array<{ status: string }> || []).map((entry, idx) => (
                          <Cell key={idx} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => v as number} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col justify-center gap-1.5">
                    {(shipmentData?.byStatus as Array<{ status: string; count: number }> || []).slice(0, 6).map(item => (
                      <div key={item.status} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[item.status] || '#94a3b8' }} />
                        <span className="text-gray-600 capitalize flex-1">{item.status.replace('_', ' ')}</span>
                        <span className="font-semibold text-gray-800">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4">Sales Pipeline</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={salesFunnel as unknown[]} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v) => [v as number, 'Deals']} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Delayed Shipments */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Delayed Shipments
                  </h2>
                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">{stats?.shipments.delayed || 0}</span>
                </div>
                <div className="space-y-3">
                  {stats?.delayedShipments && stats.delayedShipments.length > 0 ? (
                    stats.delayedShipments.map((s) => (
                      <div key={(s as { id?: string }).id} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800">{(s as { reference_number?: string }).reference_number}</span>
                          <Badge variant="warning">Delayed</Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{(s as { customer_name?: string }).customer_name}</p>
                        <p className="text-xs text-gray-400">{(s as { origin_country?: string }).origin_country} → {(s as { destination_country?: string }).destination_country}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm text-gray-500">No delayed shipments!</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Overdue Invoices */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500" />
                    Overdue Invoices
                  </h2>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">{stats?.revenue.overdue_count || 0}</span>
                </div>
                <div className="space-y-3">
                  {stats?.overdueInvoices && stats.overdueInvoices.length > 0 ? (
                    stats.overdueInvoices.map((inv, i) => (
                      <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-800">{(inv as { invoice_number?: string }).invoice_number}</span>
                          <span className="text-xs font-bold text-red-600">${Number((inv as { outstanding_amount?: number }).outstanding_amount || 0).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{(inv as { customer_name?: string }).customer_name}</p>
                        <p className="text-xs text-gray-400">Due: {(inv as { due_date?: string }).due_date ? format(new Date((inv as { due_date: string }).due_date), 'MMM d, yyyy') : 'N/A'}</p>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm text-gray-500">No overdue invoices!</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'New Shipment', href: '/shipments', color: 'bg-blue-600 text-white', icon: <Package className="w-5 h-5" /> },
                { label: 'My Deals', href: '/sales', color: 'bg-emerald-600 text-white', icon: <Briefcase className="w-5 h-5" /> },
                { label: 'New Ticket', href: '/tickets', color: 'bg-orange-500 text-white', icon: <Ticket className="w-5 h-5" /> },
                { label: 'My Tasks', href: '/tasks', color: 'bg-purple-600 text-white', icon: <CheckSquare className="w-5 h-5" /> },
              ].map(({ label, href, color, icon }) => (
                <Link key={href} href={href} className={`${color} rounded-xl p-4 flex items-center justify-between group hover:opacity-90 transition-opacity`}>
                  <div className="flex items-center gap-3">
                    {icon}
                    <span className="font-medium text-sm">{label}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              ))}
            </div>

            {/* My Performance (for non-admin sales reps) */}
            {!isAdmin && myPerf && (
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">My Performance</h2>
                    <p className="text-blue-200 text-sm">Last {period} days</p>
                  </div>
                  <div className="flex bg-blue-800/50 rounded-lg p-0.5 text-sm">
                    {(['7', '30', '90'] as Period[]).map(p => (
                      <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-md font-medium transition-all ${period === p ? 'bg-white text-blue-600 shadow' : 'text-blue-200 hover:text-white'}`}>{p}d</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-2xl font-bold">{myPerf.deals_active}</div>
                    <div className="text-blue-200 text-xs mt-1">Active Deals</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-2xl font-bold">{myPerf.deals_won}</div>
                    <div className="text-blue-200 text-xs mt-1">Deals Won</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-2xl font-bold">{fmt(myPerf.revenue_won)}</div>
                    <div className="text-blue-200 text-xs mt-1">Revenue Won</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="text-2xl font-bold">{myPerf.tasks_completed}/{myPerf.tasks_created}</div>
                    <div className="text-blue-200 text-xs mt-1">Tasks Done</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs text-blue-200 mb-1">
                      <span>Win Rate</span>
                      <span>{pct(myPerf.deals_won, myPerf.deals_won + myPerf.deals_lost || 1)}%</span>
                    </div>
                    <div className="h-2 bg-blue-800/60 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct(myPerf.deals_won, myPerf.deals_won + myPerf.deals_lost || 1)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-blue-200 mb-1">
                      <span>Task Completion</span>
                      <span>{pct(myPerf.tasks_completed, myPerf.tasks_created || 1)}%</span>
                    </div>
                    <div className="h-2 bg-blue-800/60 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${pct(myPerf.tasks_completed, myPerf.tasks_created || 1)}%` }} />
                    </div>
                  </div>
                </div>
                {myPerf.tasks_overdue > 0 && (
                  <div className="mt-3 bg-red-500/20 border border-red-400/30 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-300" />
                    <span className="text-sm text-red-200">{myPerf.tasks_overdue} overdue task{myPerf.tasks_overdue > 1 ? 's' : ''} — </span>
                    <Link href="/tasks" className="text-white underline text-sm font-medium">View Now</Link>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Link href="/sales" className="flex-1 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2">
                    <Briefcase className="w-4 h-4" />My Pipeline
                  </Link>
                  <Link href="/tasks" className="flex-1 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2">
                    <CheckSquare className="w-4 h-4" />My Tasks
                  </Link>
                  <Link href="/customers" className="flex-1 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-2 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2">
                    <Users className="w-4 h-4" />My Customers
                  </Link>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <UserCheck className="w-5 h-5 opacity-80" />
                  <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">last {period}d</span>
                </div>
                <div className="text-2xl font-bold">{salesPerf.teamStats.filter(m => m.is_active).length}</div>
                <div className="text-xs opacity-80 mt-1">Active Team Members</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-5 h-5 opacity-80" />
                  <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">won</span>
                </div>
                <div className="text-2xl font-bold">
                  {fmt(salesPerf.teamStats.reduce((a, m) => a + Number(m.revenue_won || 0), 0))}
                </div>
                <div className="text-xs opacity-80 mt-1">Total Revenue Won</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Target className="w-5 h-5 opacity-80" />
                </div>
                <div className="text-2xl font-bold">
                  {salesPerf.teamStats.reduce((a, m) => a + Number(m.deals_won || 0), 0)}
                </div>
                <div className="text-xs opacity-80 mt-1">Total Deals Won</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <CheckSquare className="w-5 h-5 opacity-80" />
                </div>
                <div className="text-2xl font-bold">
                  {salesPerf.teamStats.reduce((a, m) => a + Number(m.tasks_completed || 0), 0)}
                </div>
                <div className="text-xs opacity-80 mt-1">Tasks Completed</div>
              </div>
            </div>

            {/* Team Member Cards Grid */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Employee Performance Cards
                <span className="text-sm font-normal text-gray-500 ml-2">— last {period} days</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {salesPerf.teamStats.map((member, idx) => {
                  const wr = winRate(member);
                  const tcr = taskCompletionRate(member);
                  return (
                    <div
                      key={member.id}
                      className={`bg-white rounded-xl border-2 p-5 shadow-sm hover:shadow-md transition-shadow ${member.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${['bg-blue-500','bg-emerald-500','bg-purple-500','bg-orange-500','bg-rose-500','bg-cyan-500'][idx % 6]}`}>
                            {getInitials(member.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm leading-tight">{member.name}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[130px]">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
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
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-blue-600">{member.deals_active}</div>
                          <div className="text-xs text-gray-500">Active Deals</div>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-emerald-600">{member.deals_won}</div>
                          <div className="text-xs text-gray-500">Won</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-purple-600">{fmt(member.revenue_won)}</div>
                          <div className="text-xs text-gray-500">Revenue</div>
                        </div>
                      </div>

                      {/* Win Rate Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Win Rate</span>
                          <span className={`font-medium ${wr >= 50 ? 'text-emerald-600' : wr >= 30 ? 'text-yellow-600' : 'text-red-500'}`}>{wr}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${wr >= 50 ? 'bg-emerald-500' : wr >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${wr}%` }}
                          />
                        </div>
                      </div>

                      {/* Task Completion Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Task Completion</span>
                          <span className={`font-medium ${tcr >= 70 ? 'text-emerald-600' : tcr >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>{tcr}%</span>
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
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{member.activity_count} actions</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />+{member.customers_added} customers</span>
                        </div>
                        {member.tasks_overdue > 0 && (
                          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />{member.tasks_overdue} overdue
                          </span>
                        )}
                        {member.tasks_overdue === 0 && (
                          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />On track
                          </span>
                        )}
                      </div>

                      {/* Pipeline Value */}
                      <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Weighted Pipeline</span>
                        <span className="text-sm font-semibold text-gray-700">{fmt(member.pipeline_weighted)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leaderboard Table */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Sales Leaderboard
                </h2>
                <span className="text-xs text-gray-500">Last {period} days</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deals Won</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Win Rate</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks Done</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Activities</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pipeline</th>
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
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${['bg-blue-500','bg-emerald-500','bg-purple-500','bg-orange-500','bg-rose-500','bg-cyan-500'][idx % 6]}`}>
                                {getInitials(member.name)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-800 text-sm">{member.name}</div>
                                <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${ROLE_COLORS[member.role?.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>{member.role}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-semibold text-emerald-600">{member.deals_won}</span>
                            {member.deals_lost > 0 && <span className="text-xs text-gray-400 ml-1">/ {member.deals_lost} lost</span>}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-gray-800">{fmt(member.revenue_won)}</td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className={`font-medium text-sm ${wr >= 50 ? 'text-emerald-600' : wr >= 30 ? 'text-yellow-600' : 'text-red-500'}`}>{wr}%</span>
                              {wr >= 50 ? <ChevronUp className="w-3 h-3 text-emerald-500" /> : wr >= 30 ? <Minus className="w-3 h-3 text-yellow-500" /> : <ChevronDown className="w-3 h-3 text-red-500" />}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right text-gray-700">{member.tasks_completed}<span className="text-gray-400 text-xs">/{member.tasks_created}</span></td>
                          <td className="py-3 px-3 text-right text-gray-700">{member.activity_count}</td>
                          <td className="py-3 px-3 text-right font-medium text-purple-600">{fmt(member.pipeline_weighted)}</td>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4">Stage Distribution</h2>
                <div className="space-y-3">
                  {salesPerf.conversionRates.map(stage => {
                    const totalDeals = salesPerf.conversionRates.reduce((a, s) => a + Number(s.count || 0), 0);
                    const stagePct = totalDeals > 0 ? Math.round((Number(stage.count) / totalDeals) * 100) : 0;
                    return (
                      <div key={stage.stage}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLORS[stage.stage] || '#94a3b8' }} />
                            <span className="text-sm font-medium text-gray-700 capitalize">{stage.stage}</span>
                            <span className="text-xs text-gray-400">({stage.count} deals)</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{fmt(Number(stage.total_value))}</span>
                            <span className="font-semibold text-gray-700">{stagePct}%</span>
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
                <h2 className="font-semibold text-gray-900 mb-4">Stage Values (Bar)</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={salesPerf.conversionRates} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="total_value" name="Total Value" radius={[4, 4, 0, 0]}>
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
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  Top Active Deals
                </h2>
                <Link href="/deals" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deal</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prob.</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Route</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Close Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPerf.topDeals.map(deal => (
                      <tr key={deal.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-3">
                          <Link href={`/deals/${deal.id}`} className="text-blue-600 hover:underline font-medium">
                            {deal.deal_number}
                          </Link>
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">{deal.title}</div>
                        </td>
                        <td className="py-3 px-3 text-gray-700 text-xs">{deal.customer_name}</td>
                        <td className="py-3 px-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={{ background: STAGE_COLORS[deal.stage] + '20', color: STAGE_COLORS[deal.stage] }}>
                            {deal.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-800">{fmt(deal.value)}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`text-xs font-medium ${deal.probability >= 70 ? 'text-emerald-600' : deal.probability >= 40 ? 'text-yellow-600' : 'text-gray-500'}`}>
                            {deal.probability}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-600">
                          {deal.origin_country && deal.destination_country ? `${deal.origin_country} → ${deal.destination_country}` : '—'}
                          {deal.shipping_mode && <span className="ml-1 capitalize text-gray-400">({deal.shipping_mode})</span>}
                        </td>
                        <td className="py-3 px-3 text-xs text-gray-600">{deal.assigned_to_name || '—'}</td>
                        <td className="py-3 px-3 text-xs text-gray-500">
                          {deal.expected_close_date ? format(new Date(deal.expected_close_date), 'MMM d, yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                    {salesPerf.topDeals.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-400 text-sm">No active deals found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Team vs Pipeline Radar */}
            {salesPerf.teamStats.length > 0 && (
              <Card>
                <h2 className="font-semibold text-gray-900 mb-4">Team Activity Radar (Top 6)</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={salesPerf.teamStats.slice(0, 6).map(m => ({
                    name: m.name.split(' ')[0],
                    'Deals Active': Number(m.deals_active),
                    'Won': Number(m.deals_won),
                    'Tasks Done': Number(m.tasks_completed),
                    'Activities': Math.min(Number(m.activity_count), 50),
                    'Customers': Number(m.customers_added),
                  }))}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fontSize: 9 }} />
                    <Radar name="Deals Active" dataKey="Deals Active" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                    <Radar name="Won" dataKey="Won" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                    <Radar name="Tasks Done" dataKey="Tasks Done" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
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
