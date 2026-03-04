'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { authAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';
import { Loading, Card } from '@/components/ui';
import {
  ClipboardList, Search, Download, RefreshCw, Filter,
  ChevronDown, ChevronLeft, ChevronRight, X,
  User, Globe, Calendar, Activity,
  LogIn, UserPlus, Edit2, Trash2, Key, Shield, AlertCircle,
  CheckCircle, XCircle
} from 'lucide-react';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────
interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface LoginAttempt {
  id: string;
  email: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  result: 'success' | 'wrong_password' | 'user_not_found' | 'account_locked' | 'account_inactive';
  attempted_at: string;
  first_name?: string;
  last_name?: string;
}

// ── Action icon + color ────────────────────────────────────
const actionMeta: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  login:                    { icon: LogIn,    color: 'text-green-600 bg-green-50',  label: 'Login' },
  logout:                   { icon: LogIn,    color: 'text-gray-600 bg-gray-100',   label: 'Logout' },
  user_registered:          { icon: UserPlus, color: 'text-blue-600 bg-blue-50',    label: 'User Registered' },
  user_created:             { icon: UserPlus, color: 'text-blue-600 bg-blue-50',    label: 'User Created' },
  user_updated:             { icon: Edit2,    color: 'text-yellow-600 bg-yellow-50',label: 'User Updated' },
  user_deactivated:         { icon: Trash2,   color: 'text-red-600 bg-red-50',      label: 'User Deactivated' },
  user_unlocked:            { icon: Shield,   color: 'text-green-600 bg-green-50',  label: 'User Unlocked' },
  admin_reset_password:     { icon: Key,      color: 'text-orange-600 bg-orange-50',label: 'Password Reset' },
  new_device_login:         { icon: Globe,    color: 'text-purple-600 bg-purple-50',label: 'New Device' },
  forgot_password_requested:{ icon: Key,      color: 'text-gray-600 bg-gray-100',   label: 'Forgot Password' },
  password_reset:           { icon: Key,      color: 'text-green-600 bg-green-50',  label: 'Password Reset' },
};

const loginResultMeta = {
  success:          { icon: CheckCircle, color: 'text-green-600', label: 'Success' },
  wrong_password:   { icon: XCircle,    color: 'text-red-600',   label: 'Wrong Password' },
  user_not_found:   { icon: XCircle,    color: 'text-orange-600',label: 'User Not Found' },
  account_locked:   { icon: AlertCircle,color: 'text-red-700',   label: 'Account Locked' },
  account_inactive: { icon: AlertCircle,color: 'text-gray-600',  label: 'Inactive' },
};

// ── Main Page ────────────────────────────────────────────────
export default function ActivityLogsPage() {
  const { user: currentUser, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  // Active tab
  const [tab, setTab] = useState<'activity' | 'login'>('activity');

  // Activity logs state
  const [activityLogs, setActivityLogs]  = useState<ActivityLog[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage]   = useState(1);

  // Login attempts state
  const [loginLogs, setLoginLogs]  = useState<LoginAttempt[]>([]);
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginPage, setLoginPage]   = useState(1);

  // Shared filters
  const [search, setSearch]     = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [loading, setLoading]   = useState(false);

  const LIMIT = 20;

  // ── Fetch activity logs ────────────────────────────────────
  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authAPI.getActivityLogs({
        action: actionFilter || undefined,
        from:   fromDate  || undefined,
        to:     toDate    || undefined,
        page:   activityPage,
        limit:  LIMIT,
      });
      let rows: ActivityLog[] = res.data.data || [];
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(r =>
          r.action.toLowerCase().includes(q) ||
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.ip_address?.includes(q)
        );
      }
      setActivityLogs(rows);
      setActivityTotal(res.data.total || rows.length);
    } catch {
      setActivityLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, fromDate, toDate, activityPage, search]);

  // ── Fetch login audit logs ────────────────────────────────
  const loadLoginLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authAPI.getLoginAuditLogs({
        result: resultFilter || undefined,
        from:   fromDate     || undefined,
        to:     toDate       || undefined,
        page:   loginPage,
        limit:  LIMIT,
      });
      let rows: LoginAttempt[] = res.data.data || [];
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(r =>
          r.email.toLowerCase().includes(q) ||
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
          r.ip_address?.includes(q)
        );
      }
      setLoginLogs(rows);
      setLoginTotal(res.data.total || rows.length);
    } catch {
      setLoginLogs([]);
    } finally {
      setLoading(false);
    }
  }, [resultFilter, fromDate, toDate, loginPage, search]);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated)              { router.replace('/login');     return; }
    if (currentUser?.role !== 'Admin') { router.replace('/dashboard'); return; }
  }, [isAuthenticated, currentUser, router]);

  useEffect(() => {
    if (tab === 'activity') loadActivity();
    else loadLoginLogs();
  }, [tab, loadActivity, loadLoginLogs]);

  // ── CSV Export ────────────────────────────────────────────
  const exportCSV = () => {
    const rows = tab === 'activity' ? activityLogs : loginLogs;
    if (!rows.length) return;

    const headers = tab === 'activity'
      ? ['Timestamp', 'User', 'Email', 'Action', 'Entity', 'IP Address']
      : ['Timestamp', 'Email', 'User', 'Result', 'IP Address'];

    const lines = rows.map(r => {
      if (tab === 'activity') {
        const a = r as ActivityLog;
        return [
          a.created_at,
          `${a.first_name || ''} ${a.last_name || ''}`.trim(),
          a.email || '',
          a.action,
          a.entity_type,
          a.ip_address || '',
        ].map(v => `"${v}"`).join(',');
      } else {
        const l = r as unknown as LoginAttempt;
        return [
          l.attempted_at,
          l.email,
          `${l.first_name || ''} ${l.last_name || ''}`.trim(),
          l.result,
          l.ip_address || '',
        ].map(v => `"${v}"`).join(',');
      }
    });

    const csv  = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${tab}_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setActionFilter('');
    setResultFilter('');
  };

  const activityPages = Math.ceil(activityTotal / LIMIT);
  const loginPages    = Math.ceil(loginTotal    / LIMIT);

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-purple-600" /> {t('activityLogs.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('activityLogs.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={tab === 'activity' ? loadActivity : loadLoginLogs}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
            >
              <Download className="w-4 h-4" /> {t('activityLogs.exportCSV')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Activity', value: String(activityTotal), icon: Activity,  color: 'bg-purple-50 text-purple-700' },
            { label: 'Login Attempts', value: String(loginTotal),    icon: LogIn,     color: 'bg-blue-50 text-blue-700' },
            { label: 'Failed Logins',  value: String(loginLogs.filter(l => l.result !== 'success').length), icon: XCircle, color: 'bg-red-50 text-red-700' },
            { label: 'Locked Events',  value: String(loginLogs.filter(l => l.result === 'account_locked').length), icon: Shield, color: 'bg-orange-50 text-orange-700' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className={`p-4 flex items-center gap-3 ${color} border-0`}>
              <Icon className="w-8 h-8" />
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs font-medium opacity-80">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['activity', 'login'] as const).map(tabName => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === tabName ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabName === 'activity' ? 'Activity Logs' : 'Login Audit'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search user, action, IP…"
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {tab === 'activity' && (
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={actionFilter}
                  onChange={e => setActionFilter(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 appearance-none bg-white"
                >
                  <option value="">All Actions</option>
                  {Object.keys(actionMeta).map(a => (
                    <option key={a} value={a}>{actionMeta[a].label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}

            {tab === 'login' && (
              <div className="relative">
                <select
                  value={resultFilter}
                  onChange={e => setResultFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Results</option>
                  {Object.entries(loginResultMeta).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {(search || fromDate || toDate || actionFilter || resultFilter) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
              >
                <X className="w-4 h-4" /> Clear
              </button>
            )}
          </div>
        </Card>

        {/* Logs Table */}
        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="py-20 flex justify-center"><Loading /></div>
          ) : tab === 'activity' ? (
            /* ── Activity Table ── */
            <>
              {activityLogs.length === 0 ? (
                <div className="py-16 text-center">
                  <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{t('activityLogs.noLogs')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Timestamp', 'User', 'Action', 'Entity', 'IP Address', 'Details'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activityLogs.map(log => {
                        const meta = actionMeta[log.action] || { icon: Activity, color: 'text-gray-600 bg-gray-100', label: log.action };
                        const Icon = meta.icon;
                        return (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                            </td>
                            <td className="px-4 py-3">
                              {log.first_name ? (
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{log.first_name} {log.last_name}</p>
                                  <p className="text-xs text-gray-400">{log.email}</p>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs italic">System</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}>
                                <Icon className="w-3 h-3" />
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                                {log.entity_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {log.ip_address ? (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Globe className="w-3 h-3" /> {log.ip_address}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                              {Object.keys(log.metadata || {}).length > 0
                                ? JSON.stringify(log.metadata)
                                : '—'
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Activity Pagination */}
              {activityPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {activityPage} of {activityPages} · {activityTotal} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={activityPage === 1}
                      onClick={() => setActivityPage(p => p - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <button
                      disabled={activityPage === activityPages}
                      onClick={() => setActivityPage(p => p + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── Login Audit Table ── */
            <>
              {loginLogs.length === 0 ? (
                <div className="py-16 text-center">
                  <LogIn className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">{t('activityLogs.noLogs')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Timestamp', 'Email', 'User', 'Result', 'IP Address', 'User Agent'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loginLogs.map(log => {
                        const meta = loginResultMeta[log.result] || { icon: AlertCircle, color: 'text-gray-500', label: log.result };
                        const Icon = meta.icon;
                        return (
                          <tr key={log.id} className={`hover:bg-gray-50 ${log.result !== 'success' ? 'bg-red-50/30' : ''}`}>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {format(new Date(log.attempted_at), 'MMM d, yyyy HH:mm:ss')}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {log.email}
                            </td>
                            <td className="px-4 py-3">
                              {log.first_name ? (
                                <span className="text-sm text-gray-700">{log.first_name} {log.last_name}</span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Unknown</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
                                <Icon className="w-3.5 h-3.5" />
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {log.ip_address ? (
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" /> {log.ip_address}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate" title={log.user_agent}>
                              {log.user_agent ? log.user_agent.slice(0, 60) + '…' : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Login Audit Pagination */}
              {loginPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {loginPage} of {loginPages} · {loginTotal} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={loginPage === 1}
                      onClick={() => setLoginPage(p => p - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <button
                      disabled={loginPage === loginPages}
                      onClick={() => setLoginPage(p => p + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
