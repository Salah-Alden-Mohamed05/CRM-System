'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { leadImportAPI, authAPI } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import {
  Users, ArrowLeft, CheckCircle, AlertCircle,
  RefreshCw, BarChart2, UserCheck, Target, Shuffle,
  Hand, Layers, Clock, UserMinus, UserPlus, X, Search,
  ChevronDown, ChevronRight
} from 'lucide-react';
import Link from 'next/link';

interface PoolStats {
  total: number;
  assigned: number;
  unassigned: number;
  byStatus: Array<{ status: string; count: string }>;
  bySource: Array<{ source: string; count: string }>;
  recentBatches: Array<{
    id: string;
    batch_name: string;
    imported_by_name: string;
    actual_count: string;
    created_at: string;
  }>;
}

interface SalesRep {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  role_name?: string;
}

interface AssignedLead {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  assigned_to: string;
  assigned_to_name: string;
  assigned_to_email: string;
  assigned_at: string;
}

interface DistributionResult {
  totalLeads: number;
  totalAssigned: number;
  assignments: Array<{ userId: string; count: number }>;
}

type DistributionMode = 'equal' | 'round_robin' | 'manual' | 'custom';
type ActiveTab = 'distribute' | 'assigned';

export default function LeadDistributionPage() {
  const { user } = useAuth();
  const { t, isRTL } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ActiveTab>('distribute');
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [mode, setMode] = useState<DistributionMode>('round_robin');
  const [customCounts, setCustomCounts] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [result, setResult] = useState<DistributionResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Assigned leads state
  const [assignedLeads, setAssignedLeads] = useState<AssignedLead[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [reassignTo, setReassignTo] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignResult, setReassignResult] = useState('');
  const [reassignError, setReassignError] = useState('');
  const [assignedSearch, setAssignedSearch] = useState('');
  const [expandedRep, setExpandedRep] = useState<string | null>(null);

  const isAdmin = user?.role === 'Admin';

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [poolRes, usersRes] = await Promise.all([
        leadImportAPI.getPoolStats(),
        authAPI.getUsers(),
      ]);
      setPoolStats(poolRes.data.data);
      const allUsers = (usersRes.data.data as Array<SalesRep & { role_name?: string }>).map(u => ({
        ...u,
        role: u.role_name || u.role || '',
      }));
      const reps = allUsers.filter(u => u.role === 'Sales' || u.role === 'Admin');
      setSalesReps(reps);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadAssignedLeads = useCallback(async () => {
    setAssignedLoading(true);
    try {
      const res = await leadImportAPI.getAssignedLeads();
      setAssignedLeads(res.data.data || []);
    } catch {
      // ignore
    } finally {
      setAssignedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) { router.replace('/dashboard'); return; }
    loadData();
  }, [loadData, isAdmin, router]);

  useEffect(() => {
    if (activeTab === 'assigned') loadAssignedLeads();
  }, [activeTab, loadAssignedLeads]);

  const toggleRep = (id: string) => {
    setSelectedReps(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const handleDistribute = async () => {
    if (selectedReps.length === 0) {
      setError(isRTL ? 'اختر مندوب مبيعات واحد على الأقل' : 'Select at least one sales rep');
      return;
    }
    if ((poolStats?.unassigned ?? 0) === 0) {
      setError(isRTL ? 'لا يوجد عملاء غير معيَّنين في المجموعة' : 'No unassigned leads in pool');
      return;
    }
    setDistributing(true);
    setError('');
    try {
      const res = await leadImportAPI.distribute({
        mode,
        salesReps: selectedReps,
        customCounts: mode === 'custom' ? customCounts : undefined,
        notes,
      });
      setResult(res.data.data);
      loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Distribution failed';
      setError(msg);
    } finally {
      setDistributing(false);
    }
  };

  const handleReassign = async (unassign = false) => {
    if (selectedLeads.length === 0) {
      setReassignError(isRTL ? 'اختر عملاء محتملين أولاً' : 'Select leads first');
      return;
    }
    if (!unassign && !reassignTo) {
      setReassignError(isRTL ? 'اختر مندوباً للتحويل إليه' : 'Select a rep to reassign to');
      return;
    }
    setReassigning(true);
    setReassignError('');
    try {
      await leadImportAPI.reassignLeads({
        leadIds: selectedLeads,
        newAssigneeId: unassign ? undefined : reassignTo,
        unassign,
      });
      setReassignResult(unassign
        ? (isRTL ? `تم إلغاء تعيين ${selectedLeads.length} عميل` : `${selectedLeads.length} leads unassigned`)
        : (isRTL ? `تم إعادة تعيين ${selectedLeads.length} عميل` : `${selectedLeads.length} leads reassigned`));
      setSelectedLeads([]);
      setReassignTo('');
      loadData();
      loadAssignedLeads();
    } catch {
      setReassignError(isRTL ? 'فشل في إعادة التعيين' : 'Reassign failed');
    } finally {
      setReassigning(false);
    }
  };

  const modeOptions: Array<{ id: DistributionMode; label: string; labelAr: string; icon: React.ElementType; desc: string; descAr: string }> = [
    { id: 'round_robin', label: 'Round Robin', labelAr: 'توزيع دوري', icon: Shuffle, desc: 'Distribute one by one to each rep in rotation', descAr: 'توزيع واحد تلو الآخر بالتناوب' },
    { id: 'equal', label: 'Equal Split', labelAr: 'توزيع متساوٍ', icon: Layers, desc: 'Divide leads equally among selected reps', descAr: 'تقسيم العملاء بالتساوي بين المندوبين المختارين' },
    { id: 'manual', label: 'Manual', labelAr: 'يدوي', icon: Hand, desc: 'Distribute evenly among selected reps', descAr: 'التوزيع بالتساوي بين المندوبين المختارين' },
    { id: 'custom', label: 'Custom', labelAr: 'مخصص', icon: Target, desc: 'Set exact number of leads per rep', descAr: 'تحديد عدد محدد لكل مندوب' },
  ];

  const getSalesRepName = (id: string) => {
    const rep = salesReps.find(r => r.id === id);
    return rep ? `${rep.first_name} ${rep.last_name}` : id;
  };

  // Group assigned leads by rep
  const leadsByRep = assignedLeads.reduce<Record<string, { repName: string; repEmail: string; leads: AssignedLead[] }>>((acc, lead) => {
    const repId = lead.assigned_to;
    if (!acc[repId]) acc[repId] = { repName: lead.assigned_to_name, repEmail: lead.assigned_to_email, leads: [] };
    acc[repId].leads.push(lead);
    return acc;
  }, {});

  const filteredAssigned = assignedSearch
    ? assignedLeads.filter(l =>
        l.company_name.toLowerCase().includes(assignedSearch.toLowerCase()) ||
        l.contact_name?.toLowerCase().includes(assignedSearch.toLowerCase()) ||
        l.assigned_to_name?.toLowerCase().includes(assignedSearch.toLowerCase())
      )
    : null;

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/leads" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className={`w-5 h-5 text-gray-500 ${isRTL ? 'rotate-180' : ''}`} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {isRTL ? 'توزيع وإدارة العملاء المحتملين' : 'Lead Distribution & Management'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isRTL ? 'توزيع وإعادة تعيين العملاء المحتملين على فريق المبيعات' : 'Distribute and reassign leads across your sales team'}
            </p>
          </div>
          <button onClick={() => { loadData(); if (activeTab === 'assigned') loadAssignedLeads(); }} className="ms-auto p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Pool Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: isRTL ? 'الإجمالي' : 'Total Leads', value: poolStats?.total ?? 0, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: BarChart2 },
                { label: isRTL ? 'غير معيَّنة' : 'Unassigned', value: poolStats?.unassigned ?? 0, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', icon: Users },
                { label: isRTL ? 'معيَّنة' : 'Assigned', value: poolStats?.assigned ?? 0, color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: UserCheck },
                { label: isRTL ? 'مندوبو المبيعات' : 'Sales Reps', value: salesReps.filter(r => r.role === 'Sales').length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Target },
              ].map(stat => (
                <div key={stat.label} className={`${stat.bg} border rounded-xl p-4`}>
                  <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('distribute')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'distribute' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Shuffle className="w-4 h-4" />
                {isRTL ? 'توزيع العملاء غير المعيَّنين' : 'Distribute Unassigned'}
                {(poolStats?.unassigned ?? 0) > 0 && (
                  <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded-full font-bold">{poolStats?.unassigned}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('assigned')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'assigned' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <UserCheck className="w-4 h-4" />
                {isRTL ? 'إدارة المعيَّنين' : 'Manage Assigned'}
                {(poolStats?.assigned ?? 0) > 0 && (
                  <span className="bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded-full font-bold">{poolStats?.assigned}</span>
                )}
              </button>
            </div>

            {/* ── TAB: DISTRIBUTE UNASSIGNED ── */}
            {activeTab === 'distribute' && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Mode + Reps Selection */}
                  <div className="space-y-5">
                    {/* Distribution Mode */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {isRTL ? 'طريقة التوزيع' : 'Distribution Mode'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {modeOptions.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setMode(opt.id)}
                            className={`flex items-start gap-2 p-3 rounded-xl border-2 transition-all text-start ${
                              mode === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <opt.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${mode === opt.id ? 'text-blue-600' : 'text-gray-400'}`} />
                            <div>
                              <div className={`text-xs font-semibold ${mode === opt.id ? 'text-blue-700' : 'text-gray-700'}`}>
                                {isRTL ? opt.labelAr : opt.label}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 leading-tight">
                                {isRTL ? opt.descAr : opt.desc}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sales Reps Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-700">
                          {isRTL ? 'اختر مندوبي المبيعات' : 'Select Sales Reps'}
                        </label>
                        <button
                          onClick={() => setSelectedReps(selectedReps.length === salesReps.length ? [] : salesReps.map(r => r.id))}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          {selectedReps.length === salesReps.length ? (isRTL ? 'إلغاء الكل' : 'Deselect All') : (isRTL ? 'اختيار الكل' : 'Select All')}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {salesReps.map(rep => (
                          <label
                            key={rep.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              selectedReps.includes(rep.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedReps.includes(rep.id)}
                              onChange={() => toggleRep(rep.id)}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800 truncate">
                                {rep.first_name} {rep.last_name}
                              </div>
                              <div className="text-xs text-gray-400 truncate">{rep.email}</div>
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex-shrink-0">
                              {rep.role}
                            </span>
                            {mode === 'custom' && selectedReps.includes(rep.id) && (
                              <input
                                type="number"
                                min={0}
                                value={customCounts[rep.id] || ''}
                                onChange={e => setCustomCounts(prev => ({ ...prev, [rep.id]: Number(e.target.value) }))}
                                onClick={e => e.stopPropagation()}
                                placeholder="0"
                                className="w-14 text-xs border border-gray-300 rounded px-2 py-1"
                              />
                            )}
                          </label>
                        ))}
                        {salesReps.length === 0 && (
                          <p className="text-sm text-gray-400 text-center py-4">
                            {isRTL ? 'لا يوجد مندوبو مبيعات' : 'No sales reps found'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                      </label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        placeholder={isRTL ? 'أضف ملاحظات حول هذا التوزيع…' : 'Add notes about this distribution…'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Right: Preview + History */}
                  <div className="space-y-5">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        {isRTL ? 'معاينة التوزيع' : 'Distribution Preview'}
                      </h3>
                      {selectedReps.length === 0 ? (
                        <p className="text-xs text-gray-400">{isRTL ? 'اختر مندوبين أولاً' : 'Select reps to see preview'}</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedReps.map((repId, idx) => {
                            const unassigned = poolStats?.unassigned ?? 0;
                            let count = 0;
                            if (mode === 'equal') count = Math.floor(unassigned / selectedReps.length);
                            else if (mode === 'round_robin') count = Math.floor(unassigned / selectedReps.length) + (idx < unassigned % selectedReps.length ? 1 : 0);
                            else if (mode === 'custom') count = customCounts[repId] || 0;
                            else count = Math.floor(unassigned / selectedReps.length);
                            return (
                              <div key={repId} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600 truncate">{getSalesRepName(repId)}</span>
                                <span className="font-semibold text-blue-600 flex-shrink-0 ms-2">
                                  ~{count} {isRTL ? 'عميل' : 'leads'}
                                </span>
                              </div>
                            );
                          })}
                          <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-xs font-semibold">
                            <span className="text-gray-700">{isRTL ? 'الإجمالي' : 'Total'}</span>
                            <span className="text-gray-800">
                              {poolStats?.unassigned ?? 0} {isRTL ? 'عميل' : 'leads'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {poolStats?.recentBatches && poolStats.recentBatches.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                          {isRTL ? 'آخر الاستيرادات' : 'Recent Imports'}
                        </h3>
                        <div className="space-y-2">
                          {poolStats.recentBatches.map(batch => (
                            <div key={batch.id} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded-lg p-2.5">
                              <div className="min-w-0">
                                <div className="font-medium text-gray-700 truncate">{batch.batch_name}</div>
                                <div className="text-gray-400">{batch.imported_by_name}</div>
                              </div>
                              <div className="text-end flex-shrink-0 ms-2">
                                <div className="font-semibold text-blue-600">{batch.actual_count}</div>
                                <div className="text-gray-400">{new Date(batch.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {result && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-green-800">
                        {isRTL ? 'تم التوزيع بنجاح' : 'Distribution Successful'}
                      </h3>
                    </div>
                    <p className="text-sm text-green-700 mb-3">
                      {isRTL
                        ? `تم توزيع ${result.totalAssigned} عميل محتمل على ${result.assignments.length} مندوب`
                        : `Distributed ${result.totalAssigned} leads to ${result.assignments.length} reps`}
                    </p>
                    <div className="space-y-1">
                      {result.assignments.map(a => (
                        <div key={a.userId} className="flex justify-between text-xs text-green-600">
                          <span>{getSalesRepName(a.userId)}</span>
                          <span className="font-semibold">+{a.count} {isRTL ? 'عميل' : 'leads'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Link href="/admin/leads" className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                    <ArrowLeft className="w-4 h-4" />
                    {isRTL ? 'رجوع' : 'Back'}
                  </Link>
                  <button
                    onClick={handleDistribute}
                    disabled={distributing || selectedReps.length === 0 || (poolStats?.unassigned ?? 0) === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {distributing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {isRTL ? 'جارٍ التوزيع…' : 'Distributing…'}
                      </>
                    ) : (
                      <>
                        <Shuffle className="w-4 h-4" />
                        {isRTL ? 'توزيع العملاء المحتملين' : 'Distribute Leads'} ({poolStats?.unassigned ?? 0})
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ── TAB: MANAGE ASSIGNED ── */}
            {activeTab === 'assigned' && (
              <div className="space-y-5">
                {/* Search & Actions bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={assignedSearch}
                      onChange={e => setAssignedSearch(e.target.value)}
                      placeholder={isRTL ? 'بحث عن عميل أو مندوب...' : 'Search lead or rep...'}
                      className="w-full ps-9 pe-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {selectedLeads.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                        {selectedLeads.length} {isRTL ? 'محدد' : 'selected'}
                      </span>
                      {/* Reassign to */}
                      <select
                        value={reassignTo}
                        onChange={e => setReassignTo(e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 min-w-[160px]"
                      >
                        <option value="">{isRTL ? '— اختر مندوباً —' : '— Select rep —'}</option>
                        {salesReps.filter(r => r.role === 'Sales').map(r => (
                          <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleReassign(false)}
                        disabled={reassigning || !reassignTo}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {isRTL ? 'إعادة تعيين' : 'Reassign'}
                      </button>
                      <button
                        onClick={() => handleReassign(true)}
                        disabled={reassigning}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        {isRTL ? 'إلغاء التعيين' : 'Unassign'}
                      </button>
                      <button onClick={() => setSelectedLeads([])} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  )}
                </div>

                {reassignResult && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <p className="text-sm text-green-700">{reassignResult}</p>
                    <button onClick={() => setReassignResult('')} className="ms-auto"><X className="w-3.5 h-3.5 text-green-500" /></button>
                  </div>
                )}

                {reassignError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{reassignError}</p>
                  </div>
                )}

                {assignedLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : assignedSearch && filteredAssigned ? (
                  /* Flat list when searching */
                  <div className="space-y-2">
                    {filteredAssigned.length === 0 ? (
                      <p className="text-center text-gray-400 py-8 text-sm">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
                    ) : filteredAssigned.map(lead => (
                      <label key={lead.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedLeads.includes(lead.id) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={selectedLeads.includes(lead.id)} onChange={() => setSelectedLeads(p => p.includes(lead.id) ? p.filter(x => x !== lead.id) : [...p, lead.id])} className="w-4 h-4 rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{lead.company_name}</div>
                          <div className="text-xs text-gray-400 truncate">{lead.contact_name} · {lead.status}</div>
                        </div>
                        <div className="text-xs text-gray-500 flex-shrink-0">{lead.assigned_to_name}</div>
                      </label>
                    ))}
                  </div>
                ) : (
                  /* Grouped by rep */
                  <div className="space-y-3">
                    {Object.entries(leadsByRep).length === 0 && (
                      <div className="text-center py-12 text-gray-400">
                        <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">{isRTL ? 'لا يوجد عملاء معيَّنون حالياً' : 'No assigned leads'}</p>
                      </div>
                    )}
                    {Object.entries(leadsByRep).map(([repId, { repName, repEmail, leads }]) => {
                      const allSelected = leads.every(l => selectedLeads.includes(l.id));
                      const someSelected = leads.some(l => selectedLeads.includes(l.id));
                      const isExpanded = expandedRep === repId;
                      return (
                        <div key={repId} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div
                            className={`flex items-center gap-3 p-3 cursor-pointer select-none ${someSelected ? 'bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'}`}
                            onClick={() => setExpandedRep(isExpanded ? null : repId)}
                          >
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                              onChange={e => {
                                e.stopPropagation();
                                if (allSelected) setSelectedLeads(p => p.filter(id => !leads.map(l => l.id).includes(id)));
                                else setSelectedLeads(p => [...new Set([...p, ...leads.map(l => l.id)])]);
                              }}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 rounded"
                            />
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                              {repName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 text-sm truncate">{repName}</div>
                              <div className="text-xs text-gray-400 truncate">{repEmail}</div>
                            </div>
                            <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                              {leads.length} {isRTL ? 'عميل' : 'leads'}
                            </span>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                          </div>
                          {isExpanded && (
                            <div className="divide-y divide-gray-100">
                              {leads.map(lead => (
                                <label key={lead.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selectedLeads.includes(lead.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                  <input
                                    type="checkbox"
                                    checked={selectedLeads.includes(lead.id)}
                                    onChange={() => setSelectedLeads(p => p.includes(lead.id) ? p.filter(x => x !== lead.id) : [...p, lead.id])}
                                    className="w-4 h-4 rounded"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-800 font-medium truncate">{lead.company_name}</div>
                                    <div className="text-xs text-gray-400 truncate">
                                      {lead.contact_name}{lead.phone ? ` · ${lead.phone}` : ''}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                                      lead.status === 'new' ? 'bg-gray-100 text-gray-600' :
                                      lead.status === 'contacted' ? 'bg-blue-100 text-blue-600' :
                                      lead.status === 'qualified' ? 'bg-indigo-100 text-indigo-600' :
                                      'bg-gray-100 text-gray-500'
                                    }`}>{lead.status}</span>
                                    <span className="text-xs text-gray-400">
                                      {lead.assigned_at ? new Date(lead.assigned_at).toLocaleDateString() : ''}
                                    </span>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
