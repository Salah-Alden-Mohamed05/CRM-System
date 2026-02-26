'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { dashboardAPI } from '@/lib/api';
import { Card, Loading, StatCard } from '@/components/ui';
import { BarChart2, DollarSign, TrendingUp, Users, Package } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Cell, PieChart, Pie, FunnelChart, Funnel, LabelList,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export default function ReportsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [revenueData, setRevenueData] = useState<unknown[]>([]);
  const [shipmentData, setShipmentData] = useState<{ byStatus: unknown[]; byMode: unknown[]; monthlyTrend: unknown[] } | null>(null);
  const [salesFunnel, setSalesFunnel] = useState<unknown[]>([]);
  const [profitability, setProfitability] = useState<unknown[]>([]);
  const [kpis, setKpis] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('12');

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
    fetchData();
  }, [isAuthenticated, router, fetchData]);

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(v);

  if (loading) return <MainLayout><div className="p-8"><Loading /></div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="text-gray-500 text-sm mt-1">Business intelligence and KPI tracking</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            {['3', '6', '12', '24'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              >
                {p}M
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="New Shipments (30d)" value={kpis.new_shipments || 0} icon={<Package className="w-6 h-6" />} color="blue" />
          <StatCard title="New Customers (30d)" value={kpis.new_customers || 0} icon={<Users className="w-6 h-6" />} color="green" />
          <StatCard title="Revenue (30d)" value={fmt(Number(kpis.period_revenue || 0))} icon={<DollarSign className="w-6 h-6" />} color="purple" />
          <StatCard title="Pipeline Value" value={fmt(Number(kpis.pipeline_value || 0))} icon={<TrendingUp className="w-6 h-6" />} color="orange" />
        </div>

        {/* Revenue Trend */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-500" /> Revenue Trend
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData as unknown[]}>
              <defs>
                {['invoiced', 'collected', 'outstanding'].map((key, i) => (
                  <linearGradient key={key} id={key} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(Number(v ?? 0))} />
              <Legend />
              <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke={COLORS[0]} fill={`url(#invoiced)`} strokeWidth={2} />
              <Area type="monotone" dataKey="collected" name="Collected" stroke={COLORS[1]} fill={`url(#collected)`} strokeWidth={2} />
              <Area type="monotone" dataKey="outstanding" name="Outstanding" stroke={COLORS[2]} fill={`url(#outstanding)`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Shipment Trend */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Shipment Volume Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={shipmentData?.monthlyTrend as unknown[] || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delayed" name="Delayed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Sales Funnel */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Sales Pipeline Funnel</h2>
            <div className="space-y-2">
              {(salesFunnel as Array<{stage: string; count: number; total_value: number; weighted_value: number}>).map((item, i) => (
                <div key={item.stage} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 w-20 capitalize">{item.stage}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div
                      className="h-6 rounded-full flex items-center justify-end pr-3 transition-all"
                      style={{
                        width: `${Math.max((item.count / Math.max(...(salesFunnel as Array<{count: number}>).map(f => f.count), 1)) * 100, 10)}%`,
                        background: COLORS[i % COLORS.length]
                      }}
                    >
                      <span className="text-white text-xs font-bold">{item.count}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 w-24 text-right">{fmt(Number(item.weighted_value))}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shipping Mode Distribution */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Shipments by Mode</h2>
            <div className="flex items-center">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={shipmentData?.byMode as unknown[] || []}
                    dataKey="count"
                    nameKey="shipping_mode"
                    cx="50%" cy="50%"
                    outerRadius={80}
                  >
                    {(shipmentData?.byMode as Array<{shipping_mode: string}> || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 pl-4">
                {(shipmentData?.byMode as Array<{shipping_mode: string; count: number}> || []).map((item, i) => (
                  <div key={item.shipping_mode} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="capitalize flex-1 text-gray-600">{item.shipping_mode}</span>
                    <span className="font-semibold text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Customer Profitability */}
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Top Customers by Profit</h2>
            <div className="space-y-3 max-h-52 overflow-y-auto">
              {(profitability as Array<{id: string; company_name: string; total_revenue: number; total_costs: number; profit: number; profit_margin: number}>).slice(0, 8).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  >
                    {c.company_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-800 truncate">{c.company_name}</p>
                      <span className="text-xs font-bold text-green-600 ml-2">{fmt(Number(c.profit))}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(Math.max(Number(c.profit_margin), 0), 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{Number(c.profit_margin).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* KPI Summary Table */}
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">30-Day Performance Summary</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { label: 'New Shipments', value: kpis.new_shipments || 0, unit: '' },
              { label: 'New Customers', value: kpis.new_customers || 0, unit: '' },
              { label: 'New Tickets', value: kpis.new_tickets || 0, unit: '' },
              { label: 'Resolved Tickets', value: kpis.resolved_tickets || 0, unit: '' },
              { label: 'Avg Resolution', value: kpis.avg_resolution_hours ? Number(kpis.avg_resolution_hours).toFixed(1) : 'N/A', unit: 'hrs' },
              { label: 'Active Delayed', value: kpis.current_delayed || 0, unit: '' },
              { label: 'Active Pipeline', value: kpis.active_pipeline_count || 0, unit: '' },
              { label: 'Pipeline Value', value: fmt(Number(kpis.pipeline_value || 0)), unit: '' },
              { label: 'Period Revenue', value: fmt(Number(kpis.period_revenue || 0)), unit: '' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="p-4 bg-gray-50 rounded-xl text-center">
                <p className="text-xl font-bold text-gray-900">{value}{unit}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
