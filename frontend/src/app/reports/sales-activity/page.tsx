'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { salesAPI } from '@/lib/api';
import {
  BarChart2, Calendar, RefreshCw, Download, Users, TrendingUp,
  Phone, Mail, FileText, CheckCircle, XCircle, Award, DollarSign,
  ArrowRight, ChevronDown, ChevronUp, Filter
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserReport {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  leads_created: number;
  leads_contacted: number;
  deals_created: number;
  rfqs_submitted: number;
  quotations_created: number;
  quotations_sent: number;
  deals_won: number;
  deals_lost: number;
  activities_total: number;
  calls_made: number;
  emails_sent: number;
  pipeline_value: number;
  won_value: number;
}

interface ReportData {
  period: string;
  startDate: string;
  endDate: string;
  perUser: UserReport[];
  totals: Record<string, number>;
  generatedAt: string;
  generatedBy: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);

const fmtDate = (d: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ─── Metric Cell ─────────────────────────────────────────────────────────────
function MetricCell({ value, highlight = false }: { value: number | string; highlight?: boolean }) {
  return (
    <td className={`px-3 py-3 text-center text-sm font-semibold ${highlight ? 'text-emerald-700 bg-emerald-50' : Number(value) === 0 ? 'text-gray-300' : 'text-gray-800'}`}>
      {value}
    </td>
  );
}

export default function SalesActivityReportPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'custom'>('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<keyof UserReport>('deals_won');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!['Admin', 'Sales', 'Operations'].includes(user?.role || '')) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, user, router]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { period };
      if (period === 'custom') {
        if (!customFrom || !customTo) { setError('Please select both start and end dates'); setLoading(false); return; }
        params.from = customFrom;
        params.to = customTo;
      }
      const res = await salesAPI.getActivityReport(params);
      setReport(res.data.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    if (isAuthenticated) fetchReport();
  }, [isAuthenticated, fetchReport]);

  const handleSort = (field: keyof UserReport) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const sortedUsers = report?.perUser
    ? [...report.perUser].sort((a, b) => {
        const av = Number(a[sortBy]) || 0;
        const bv = Number(b[sortBy]) || 0;
        return sortDir === 'asc' ? av - bv : bv - av;
      })
    : [];

  const exportCSV = () => {
    if (!report) return;
    const headers = ['Employee','Role','Email','Leads Created','Leads Contacted','Deals Created','RFQs','Quotations Created','Quotations Sent','Deals Won','Deals Lost','Calls','Emails','Activities','Pipeline Value','Won Value'];
    const rows = report.perUser.map(u => [
      u.user_name, u.user_role, u.user_email,
      u.leads_created, u.leads_contacted, u.deals_created,
      u.rfqs_submitted, u.quotations_created, u.quotations_sent,
      u.deals_won, u.deals_lost, u.calls_made, u.emails_sent,
      u.activities_total, u.pipeline_value, u.won_value
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-activity-report-${report.startDate}-${report.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ field, label }: { field: keyof UserReport; label: string }) => (
    <th
      className="px-3 py-3 text-center text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {label}
        {sortBy === field ? (
          sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
        ) : <div className="w-3 h-3 opacity-0" />}
      </div>
    </th>
  );

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-600" />
              Sales Activity Report
            </h1>
            {report && (
              <p className="text-sm text-gray-500 mt-0.5">
                {fmtDate(report.startDate)} – {fmtDate(report.endDate)} · Generated by {report.generatedBy}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={fetchReport} disabled={loading} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </button>
            <button onClick={exportCSV} disabled={!report} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
              <Download className="w-4 h-4" />Export CSV
            </button>
          </div>
        </div>

        {/* ── Period Selector ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Period:</span>
            </div>
            <div className="flex gap-2">
              {(['weekly', 'monthly', 'custom'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === p ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                <button onClick={fetchReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Apply</button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="text-center py-16 text-gray-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
            <p>Loading report...</p>
          </div>
        )}

        {report && !loading && (
          <>
            {/* ── Totals KPI Strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: 'Leads Created',    value: report.totals.leads_created || 0,     icon: Users,         color: 'text-blue-600',    bg: 'bg-blue-50' },
                { label: 'Leads Contacted',  value: report.totals.leads_contacted || 0,   icon: Phone,         color: 'text-indigo-600',  bg: 'bg-indigo-50' },
                { label: 'Deals Created',    value: report.totals.deals_created || 0,     icon: TrendingUp,    color: 'text-violet-600',  bg: 'bg-violet-50' },
                { label: 'RFQs Submitted',   value: report.totals.rfqs_submitted || 0,    icon: FileText,      color: 'text-amber-600',   bg: 'bg-amber-50' },
                { label: 'Quotations Sent',  value: report.totals.quotations_sent || 0,   icon: Mail,          color: 'text-cyan-600',    bg: 'bg-cyan-50' },
                { label: 'Deals Won',        value: report.totals.deals_won || 0,         icon: Award,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Deals Lost',       value: report.totals.deals_lost || 0,        icon: XCircle,       color: 'text-red-600',     bg: 'bg-red-50' },
                { label: 'Won Value',        value: fmt(report.totals.won_value || 0),    icon: DollarSign,    color: 'text-green-700',   bg: 'bg-green-50' },
              ].map(kpi => (
                <div key={kpi.label} className={`${kpi.bg} rounded-xl p-3 border border-white shadow-sm`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 leading-tight">{kpi.label}</span>
                    <kpi.icon className={`w-4 h-4 ${kpi.color} flex-shrink-0`} />
                  </div>
                  <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* ── Per-Employee Table ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Per-Employee Breakdown
                  <span className="text-sm font-normal text-gray-400">({sortedUsers.length} employees)</span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 sticky left-0 bg-gray-50">Employee</th>
                      <SortHeader field="leads_created"     label="Leads" />
                      <SortHeader field="leads_contacted"   label="Contacted" />
                      <SortHeader field="deals_created"     label="Deals" />
                      <SortHeader field="rfqs_submitted"    label="RFQs" />
                      <SortHeader field="quotations_created" label="Quot. Created" />
                      <SortHeader field="quotations_sent"   label="Quot. Sent" />
                      <SortHeader field="deals_won"         label="Won" />
                      <SortHeader field="deals_lost"        label="Lost" />
                      <SortHeader field="calls_made"        label="Calls" />
                      <SortHeader field="emails_sent"       label="Emails" />
                      <SortHeader field="activities_total"  label="Activities" />
                      <SortHeader field="pipeline_value"    label="Pipeline $" />
                      <SortHeader field="won_value"         label="Won $" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((u, idx) => (
                      <>
                        <tr
                          key={u.user_id}
                          className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                          onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}
                        >
                          <td className="px-4 py-3 sticky left-0 bg-white border-r border-gray-50">
                            <div className="flex items-center gap-3 min-w-[180px]">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-blue-600">{u.user_name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase()}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{u.user_name}</p>
                                <p className="text-xs text-gray-400 truncate">{u.user_role}</p>
                              </div>
                              {expandedUser === u.user_id ? <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                            </div>
                          </td>
                          <MetricCell value={u.leads_created} />
                          <MetricCell value={u.leads_contacted} />
                          <MetricCell value={u.deals_created} />
                          <MetricCell value={u.rfqs_submitted} />
                          <MetricCell value={u.quotations_created} />
                          <MetricCell value={u.quotations_sent} />
                          <MetricCell value={u.deals_won} highlight={u.deals_won > 0} />
                          <MetricCell value={u.deals_lost} />
                          <MetricCell value={u.calls_made} />
                          <MetricCell value={u.emails_sent} />
                          <MetricCell value={u.activities_total} />
                          <MetricCell value={fmt(u.pipeline_value)} />
                          <MetricCell value={fmt(u.won_value)} highlight={u.won_value > 0} />
                        </tr>
                        {expandedUser === u.user_id && (
                          <tr key={`${u.user_id}-detail`} className="bg-blue-50/50">
                            <td colSpan={14} className="px-6 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-2">Lead Performance</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-600">Created:</span><span className="font-semibold">{u.leads_created}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Contacted:</span><span className="font-semibold">{u.leads_contacted}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Contact Rate:</span><span className={`font-semibold ${u.leads_created > 0 && (u.leads_contacted/u.leads_created) >= 0.5 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                      {u.leads_created > 0 ? Math.round((u.leads_contacted/u.leads_created)*100) : 0}%
                                    </span></div>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-2">Deal Performance</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-600">Created:</span><span className="font-semibold">{u.deals_created}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Won:</span><span className="font-semibold text-emerald-600">{u.deals_won}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Win Rate:</span><span className={`font-semibold ${u.deals_created > 0 && (u.deals_won/u.deals_created) >= 0.3 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                      {u.deals_created > 0 ? Math.round((u.deals_won/(u.deals_won+u.deals_lost||1))*100) : 0}%
                                    </span></div>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-2">Quotation Activity</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-600">Created:</span><span className="font-semibold">{u.quotations_created}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Sent:</span><span className="font-semibold">{u.quotations_sent}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">RFQs:</span><span className="font-semibold">{u.rfqs_submitted}</span></div>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-2">Revenue Impact</p>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-600">Pipeline:</span><span className="font-semibold text-blue-600">{fmt(u.pipeline_value)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Won:</span><span className="font-semibold text-emerald-600">{fmt(u.won_value)}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Email:</span><span className="font-semibold">{u.user_email}</span></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}

                    {/* Totals row */}
                    {sortedUsers.length > 0 && (
                      <tr className="bg-gray-900 text-white font-bold">
                        <td className="px-4 py-3 sticky left-0 bg-gray-900 text-sm">TOTAL ({sortedUsers.length} employees)</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.leads_created || 0}</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.leads_contacted || 0}</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.deals_created || 0}</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.rfqs_submitted || 0}</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.quotations_created || 0}</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.quotations_sent || 0}</td>
                        <td className="px-3 py-3 text-center text-sm text-emerald-300">{report.totals.deals_won || 0}</td>
                        <td className="px-3 py-3 text-center text-sm text-red-300">{report.totals.deals_lost || 0}</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.calls_made || 0}</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.emails_sent || 0}</td>
                        <td className="px-3 py-3 text-center text-sm">{report.totals.activities_total || 0}</td>
                        <td className="px-3 py-3 text-center text-sm text-blue-300">{fmt(report.totals.pipeline_value || 0)}</td>
                        <td className="px-3 py-3 text-center text-sm text-emerald-300">{fmt(report.totals.won_value || 0)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {sortedUsers.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No data for this period</p>
                  <p className="text-sm mt-1">Try selecting a different time range</p>
                </div>
              )}
            </div>

            {/* ── Notes ── */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
              <p><strong>Notes:</strong> This report shows activity counts for the selected period only.</p>
              <p>• <strong>Leads</strong> = New leads created or contacted in the period</p>
              <p>• <strong>Win Rate</strong> = Won ÷ (Won + Lost) to exclude ongoing deals</p>
              <p>• <strong>Pipeline Value</strong> = Total value of currently active (non-closed) deals</p>
              <p>• <strong>Won Value</strong> = Total value of deals won during the selected period</p>
              <p>Click any row to see detailed breakdown.</p>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
