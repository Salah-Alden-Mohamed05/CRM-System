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
  Ticket, Clock, Activity, ArrowRight, CheckCircle
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  booking: '#6366f1', pickup: '#8b5cf6', customs_export: '#f59e0b',
  departed: '#3b82f6', in_transit: '#06b6d4', customs_import: '#f97316',
  arrived: '#84cc16', delivered: '#10b981', cancelled: '#ef4444',
};

export default function DashboardPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<unknown[]>([]);
  const [shipmentData, setShipmentData] = useState<{ byStatus: unknown[]; byMode: unknown[] } | null>(null);
  const [salesFunnel, setSalesFunnel] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, revenueRes, shipmentRes, salesRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getRevenueChart({ period: 6 }),
        dashboardAPI.getShipmentChart(),
        dashboardAPI.getSalesFunnel(),
      ]);
      setStats(statsRes.data.data);
      setRevenueData(revenueRes.data.data);
      setShipmentData(shipmentRes.data.data);
      setSalesFunnel(salesRes.data.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(v);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, MMMM do yyyy')}</p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Activity className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* KPI Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Active Shipments"
              value={stats.shipments.active}
              icon={<Package className="w-6 h-6" />}
              subtitle={`${stats.shipments.delayed} delayed`}
              color="blue"
            />
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats.revenue.total_invoiced)}
              icon={<DollarSign className="w-6 h-6" />}
              subtitle={`${formatCurrency(stats.revenue.total_outstanding)} outstanding`}
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
              value={formatCurrency(stats.sales.weighted_pipeline)}
              icon={<TrendingUp className="w-6 h-6" />}
              subtitle={`${stats.sales.active} active deals`}
              color="purple"
            />
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Insights */}
          <AIInsightsPanel />
          {/* Revenue Chart */}
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
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#3b82f6" fill="url(#invoiced)" strokeWidth={2} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" fill="url(#collected)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Shipments by Status */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Shipments by Status</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={shipmentData?.byStatus as unknown[] || []}
                    dataKey="count"
                    nameKey="status"
                    cx="50%" cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {(shipmentData?.byStatus as Array<{status: string}> || []).map((entry, idx) => (
                      <Cell key={idx} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => v} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col justify-center gap-1.5">
                {(shipmentData?.byStatus as Array<{status: string; count: number}> || []).slice(0, 6).map((item) => (
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

        {/* Sales Funnel + Bottom Rows */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Funnel */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Sales Pipeline</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesFunnel as unknown[]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v: number) => [v, 'Deals']} />
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
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                {stats?.shipments.delayed || 0}
              </span>
            </div>
            <div className="space-y-3">
              {stats?.delayedShipments && stats.delayedShipments.length > 0 ? (
                stats.delayedShipments.map((s) => (
                  <div key={s.id} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800">{(s as {reference_number?: string}).reference_number}</span>
                      <Badge variant="warning">Delayed</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{(s as {customer_name?: string}).customer_name}</p>
                    <p className="text-xs text-gray-400">{(s as {origin_country?: string}).origin_country} → {(s as {destination_country?: string}).destination_country}</p>
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
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                {stats?.revenue.overdue_count || 0}
              </span>
            </div>
            <div className="space-y-3">
              {stats?.overdueInvoices && stats.overdueInvoices.length > 0 ? (
                stats.overdueInvoices.map((inv, i) => (
                  <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-800">{(inv as {invoice_number?: string}).invoice_number}</span>
                      <span className="text-xs font-bold text-red-600">
                        ${Number((inv as {outstanding_amount?: number}).outstanding_amount || 0).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{(inv as {customer_name?: string}).customer_name}</p>
                    <p className="text-xs text-gray-400">
                      Due: {(inv as {due_date?: string}).due_date ? format(new Date((inv as {due_date: string}).due_date), 'MMM d, yyyy') : 'N/A'}
                    </p>
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
            { label: 'New Customer', href: '/customers', color: 'bg-emerald-600 text-white', icon: <Users className="w-5 h-5" /> },
            { label: 'New Ticket', href: '/tickets', color: 'bg-orange-500 text-white', icon: <Ticket className="w-5 h-5" /> },
            { label: 'View Reports', href: '/reports', color: 'bg-purple-600 text-white', icon: <TrendingUp className="w-5 h-5" /> },
          ].map(({ label, href, color, icon }) => (
            <a
              key={href}
              href={href}
              className={`${color} rounded-xl p-4 flex items-center justify-between group hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                {icon}
                <span className="font-medium text-sm">{label}</span>
              </div>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
