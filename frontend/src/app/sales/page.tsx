'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { salesAPI, customersAPI, tasksAPI, dashboardAPI } from '@/lib/api';
import { Loading } from '@/components/ui';
import {
  TrendingUp, Plus, DollarSign, Target, Calendar, Users, ChevronRight,
  Search, Filter, RefreshCw, Award, CheckSquare, Clock, AlertTriangle,
  Phone, Mail, MessageSquare, Activity, BarChart2, Eye, Edit2, Trash2,
  ArrowRight, Star, Briefcase, UserCheck, Globe, X, CheckCircle, XCircle,
  MoreVertical, Package
} from 'lucide-react';
import Link from 'next/link';
import { format, formatDistanceToNow, isPast } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: string;
  title: string;
  stage: string;
  value: number;
  probability: number;
  expected_close_date?: string;
  customer_name?: string;
  customer_id?: string;
  assigned_to_name?: string;
  assigned_to?: string;
  origin_country?: string;
  destination_country?: string;
  shipping_mode?: string;
  service_type?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: string;
  company_name: string;
  country?: string;
  status: string;
  industry?: string;
  email?: string;
  phone?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  shipment_count?: number;
  deal_count?: number;
  revenue?: number;
}

interface SalesMetrics {
  deals_active: number;
  deals_won: number;
  deals_lost: number;
  revenue_won: number;
  pipeline_weighted: number;
  tasks_overdue: number;
  tasks_completed: number;
  activity_count: number;
}

// ─── Stage Config ──────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'lead',        label: 'Lead',        color: 'bg-gray-100  border-gray-300  text-gray-700',   dot: 'bg-gray-400',   prob: 10  },
  { key: 'contacted',   label: 'Contacted',   color: 'bg-blue-50   border-blue-300   text-blue-700',   dot: 'bg-blue-500',   prob: 25  },
  { key: 'quotation',   label: 'Quotation',   color: 'bg-yellow-50 border-yellow-300 text-yellow-700', dot: 'bg-yellow-500', prob: 50  },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-orange-50 border-orange-300 text-orange-700', dot: 'bg-orange-500', prob: 75  },
  { key: 'won',         label: 'Won',         color: 'bg-green-50  border-green-300  text-green-700',  dot: 'bg-green-500',  prob: 100 },
  { key: 'lost',        label: 'Lost',        color: 'bg-red-50    border-red-300    text-red-700',    dot: 'bg-red-500',    prob: 0   },
];

const STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8', contacted: '#3b82f6', quotation: '#f59e0b',
  negotiation: '#f97316', won: '#10b981', lost: '#ef4444',
};

const SHIPPING_MODES = ['', 'sea', 'air', 'road', 'rail', 'multimodal'];
const SHIPPING_ICONS: Record<string, string> = { sea: '🚢', air: '✈️', road: '🚛', rail: '🚂', multimodal: '🔗' };

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);

// ─── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: string; msg: string; type: 'success' | 'error'; }
function Toasts({ list, remove }: { list: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {list.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {t.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => remove(t.id)}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Deal Form Modal ────────────────────────────────────────────────────────────
function DealFormModal({
  customers, onSave, onClose, initial
}: {
  customers: Customer[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  initial?: Partial<Opportunity>;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    title: initial?.title || '',
    customerId: initial?.customer_id || '',
    stage: initial?.stage || 'lead',
    value: String(initial?.value || ''),
    probability: String(initial?.probability || ''),
    expectedCloseDate: initial?.expected_close_date ? initial.expected_close_date.split('T')[0] : '',
    shippingMode: initial?.shipping_mode || '',
    serviceType: initial?.service_type || '',
    originCountry: initial?.origin_country || '',
    destinationCountry: initial?.destination_country || '',
    notes: initial?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.customerId) { setErr('Title and Customer are required'); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        value: parseFloat(form.value) || 0,
        probability: parseInt(form.probability) || undefined,
      });
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            {isEdit ? 'Edit Deal' : 'New Deal'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2"><XCircle className="w-4 h-4" />{err}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deal Title *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="FCL Container China→USA" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value (USD)</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="25000" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Probability (%)</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} placeholder="Auto" min="0" max="100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Close Date</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.expectedCloseDate} onChange={e => setForm({ ...form, expectedCloseDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Mode</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.shippingMode} onChange={e => setForm({ ...form, shippingMode: e.target.value })}>
                <option value="">Select Mode</option>
                {SHIPPING_MODES.filter(Boolean).map(m => <option key={m} value={m}>{SHIPPING_ICONS[m]} {m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin Country</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.originCountry} onChange={e => setForm({ ...form, originCountry: e.target.value })} placeholder="China" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination Country</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.destinationCountry} onChange={e => setForm({ ...form, destinationCountry: e.target.value })} placeholder="USA" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.serviceType} onChange={e => setForm({ ...form, serviceType: e.target.value })} placeholder="FCL, LCL, Air Express, Door-to-Door..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Deal notes, client requirements..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Deal Card ─────────────────────────────────────────────────────────────────
function DealCard({ deal, onEdit, onDelete, onMoveStage }: {
  deal: Opportunity;
  onEdit: () => void;
  onDelete: () => void;
  onMoveStage: (stage: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const isOverdue = deal.expected_close_date && isPast(new Date(deal.expected_close_date)) && deal.stage !== 'won' && deal.stage !== 'lost';

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all group relative ${isOverdue ? 'border-orange-200' : 'border-gray-200'}`}>
      {isOverdue && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400" title="Overdue" />}

      <Link href={`/sales/${deal.id}`} className="block p-3">
        <p className="font-semibold text-xs text-gray-900 mb-1 leading-tight line-clamp-2">{deal.title}</p>
        <p className="text-xs text-gray-500 mb-2 truncate">{deal.customer_name}</p>

        {(deal.origin_country || deal.destination_country) && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
            <Globe className="w-3 h-3" />
            <span className="truncate">
              {deal.origin_country && deal.destination_country
                ? `${deal.origin_country} → ${deal.destination_country}`
                : deal.origin_country || deal.destination_country}
            </span>
            {deal.shipping_mode && <span>{SHIPPING_ICONS[deal.shipping_mode] || ''}</span>}
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-emerald-600">
            <DollarSign className="w-3 h-3" />
            <span className="text-xs font-bold">{fmt(Number(deal.value))}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Target className="w-3 h-3" />
            <span className="text-xs">{deal.probability}%</span>
          </div>
        </div>

        {/* Probability bar */}
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all" style={{ width: `${deal.probability}%`, background: STAGE_COLORS[deal.stage] || '#94a3b8' }} />
        </div>

        {deal.expected_close_date && (
          <div className={`flex items-center gap-1 text-xs mb-1 ${isOverdue ? 'text-orange-500' : 'text-gray-400'}`}>
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(deal.expected_close_date), 'MMM d, yyyy')}</span>
            {isOverdue && <span className="text-orange-500">(overdue)</span>}
          </div>
        )}
      </Link>

      {/* Action buttons */}
      <div className="px-3 pb-2 flex items-center justify-between border-t border-gray-50 pt-2">
        <div className="flex gap-1">
          {STAGES.filter(s => s.key !== deal.stage && !['won', 'lost'].includes(s.key)).slice(0, 2).map(s => (
            <button key={s.key} onClick={() => onMoveStage(s.key)}
              className="text-xs bg-gray-50 hover:bg-blue-50 hover:text-blue-700 px-2 py-0.5 rounded-md transition-colors border border-gray-200">
              → {s.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1 hover:bg-gray-100 rounded">
            <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-10 min-w-[120px]">
              <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"><Edit2 className="w-3 h-3" />Edit</button>
              <button onClick={() => { onMoveStage('won'); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50"><CheckCircle className="w-3 h-3" />Mark Won</button>
              <button onClick={() => { onMoveStage('lost'); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"><XCircle className="w-3 h-3" />Mark Lost</button>
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"><Trash2 className="w-3 h-3" />Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Sales Page ───────────────────────────────────────────────────────────
export default function SalesPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin' || user?.role === 'Admin';
  const isSales = user?.role === 'sales' || user?.role === 'Sales';

  const [opportunities, setOpportunities] = useState<Record<string, Opportunity[]>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [myCustomers, setMyCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list' | 'customers'>('kanban');
  const [activeTab, setActiveTab] = useState<'my-deals' | 'all-deals'>('my-deals');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Opportunity | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 500 };
      if (!isAdmin && activeTab === 'my-deals') {
        params.assignedTo = user?.id;
      }
      if (search) params.search = search;
      if (stageFilter) params.stage = stageFilter;

      const [oppRes, custRes] = await Promise.all([
        salesAPI.getOpportunities(params),
        customersAPI.getAll({ limit: 200 }),
      ]);

      const pipeline: Record<string, Opportunity[]> = {
        lead: [], contacted: [], quotation: [], negotiation: [], won: [], lost: [],
      };
      (oppRes.data.data as Opportunity[]).forEach((opp) => {
        if (pipeline[opp.stage]) pipeline[opp.stage].push(opp);
      });
      setOpportunities(pipeline);
      setCustomers(custRes.data.data as Customer[]);

      // My customers = assigned to me or have deals owned by me
      const allCust = custRes.data.data as Customer[];
      const myC = isAdmin ? allCust : allCust.filter(c => c.assigned_to === user?.id);
      setMyCustomers(myC);

      // Calculate metrics from pipeline
      const allDeals = (oppRes.data.data as Opportunity[]);
      const myDeals = isAdmin ? allDeals : allDeals.filter(d => d.assigned_to === user?.id);
      setMetrics({
        deals_active: myDeals.filter(d => !['won', 'lost'].includes(d.stage)).length,
        deals_won: myDeals.filter(d => d.stage === 'won').length,
        deals_lost: myDeals.filter(d => d.stage === 'lost').length,
        revenue_won: myDeals.filter(d => d.stage === 'won').reduce((a, d) => a + Number(d.value), 0),
        pipeline_weighted: myDeals.filter(d => !['won', 'lost'].includes(d.stage)).reduce((a, d) => a + (Number(d.value) * Number(d.probability) / 100), 0),
        tasks_overdue: 0,
        tasks_completed: 0,
        activity_count: 0,
      });

      // Fetch personal perf if admin
      if (isAdmin) {
        try {
          const perfRes = await dashboardAPI.getSalesTeamPerformance({ period: 30 });
          const me = (perfRes.data.data as { teamStats: SalesMetrics[] })?.teamStats?.find((m: { id?: string } & SalesMetrics) => m.id === user?.id);
          if (me) setMetrics(me);
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('Sales fetch error:', err);
      addToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id, activeTab, search, stageFilter]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace('/login'); return; }
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, authLoading, router, fetchData]);

  const handleCreate = async (data: Record<string, unknown>) => {
    await salesAPI.createOpportunity({ ...data, assignedTo: data.assignedTo || user?.id });
    setShowCreateModal(false);
    addToast('Deal created successfully');
    fetchData();
  };

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!editingDeal) return;
    await salesAPI.updateOpportunity(editingDeal.id, data);
    setEditingDeal(null);
    addToast('Deal updated successfully');
    fetchData();
  };

  const handleDelete = async (id: string) => {
    try {
      await salesAPI.updateOpportunity(id, { stage: 'lost' });
      setDeletingId(null);
      addToast('Deal marked as lost');
      fetchData();
    } catch {
      addToast('Failed to delete deal', 'error');
    }
  };

  const handleMoveStage = async (id: string, stage: string) => {
    try {
      await salesAPI.updateStage(id, { stage });
      addToast(`Deal moved to ${stage}`);
      fetchData();
    } catch {
      addToast('Failed to move stage', 'error');
    }
  };

  const allDeals = Object.values(opportunities).flat();
  const filteredDeals = allDeals.filter(d => {
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase()) || (d.customer_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStage = !stageFilter || d.stage === stageFilter;
    return matchSearch && matchStage;
  });
  const pipelineTotal = allDeals.filter(d => !['won', 'lost'].includes(d.stage)).reduce((a, d) => a + Number(d.value || 0), 0);

  if (authLoading) return <MainLayout><div className="p-8"><Loading /></div></MainLayout>;

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isAdmin ? 'Sales Pipeline' : 'My Sales Dashboard'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {allDeals.length} deals · {fmt(pipelineTotal)} pipeline value
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg">
              <RefreshCw className="w-4 h-4" />Refresh
            </button>
            <Link href="/sales/my-leads" className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg">
              <Star className="w-4 h-4" />My Leads
            </Link>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />New Deal
            </button>
          </div>
        </div>

        {/* ── Performance Cards ── */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2 mb-1"><Briefcase className="w-4 h-4 opacity-80" /><span className="text-xs opacity-70">Active Deals</span></div>
              <div className="text-2xl font-bold">{metrics.deals_active}</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 opacity-80" /><span className="text-xs opacity-70">Won</span></div>
              <div className="text-2xl font-bold">{metrics.deals_won}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 opacity-80" /><span className="text-xs opacity-70">Revenue Won</span></div>
              <div className="text-xl font-bold">{fmt(metrics.revenue_won)}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 opacity-80" /><span className="text-xs opacity-70">Weighted Pipeline</span></div>
              <div className="text-xl font-bold">{fmt(metrics.pipeline_weighted)}</div>
            </div>
            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-3 text-white">
              <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 opacity-80" /><span className="text-xs opacity-70">My Customers</span></div>
              <div className="text-2xl font-bold">{myCustomers.length}</div>
            </div>
          </div>
        )}

        {/* ── Stage Summary Bar ── */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {STAGES.map(({ key, label, dot }) => (
            <button key={key} onClick={() => setStageFilter(stageFilter === key ? '' : key)}
              className={`text-center p-3 rounded-xl border-2 transition-all hover:shadow-md ${stageFilter === key ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="text-xs font-medium text-gray-600">{label}</span>
              </div>
              <p className="font-bold text-gray-900">{(opportunities[key] || []).length}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fmt((opportunities[key] || []).reduce((a, d) => a + Number(d.value), 0))}</p>
            </button>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals, customers..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          {isAdmin && (
            <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
              {(['my-deals', 'all-deals'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`px-3 py-1.5 rounded-md font-medium transition-all ${activeTab === t ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t === 'my-deals' ? 'My Deals' : 'All Deals'}
                </button>
              ))}
            </div>
          )}
          <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
            {([
              { v: 'kanban', icon: BarChart2 },
              { v: 'list', icon: Filter },
              { v: 'customers', icon: Users },
            ] as { v: typeof view; icon: React.ElementType }[]).map(({ v, icon: Icon }) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1 ${view === v ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="capitalize">{v}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loading /></div>
        ) : (
          <>
            {/* ══ KANBAN VIEW ══ */}
            {view === 'kanban' && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {STAGES.map(({ key, label, color }) => (
                  <div key={key} className="flex-shrink-0 w-72">
                    <div className={`p-3 rounded-t-xl border border-b-0 ${color} flex items-center justify-between`}>
                      <span className="font-semibold text-sm">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-70">{fmt((opportunities[key] || []).reduce((a, d) => a + Number(d.value), 0))}</span>
                        <span className="bg-white/60 text-xs font-bold px-1.5 py-0.5 rounded-full">{(opportunities[key] || []).length}</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-b-xl border border-t-0 border-gray-200 min-h-24 p-2 space-y-2">
                      {(opportunities[key] || []).map(deal => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          onEdit={() => setEditingDeal(deal)}
                          onDelete={() => setDeletingId(deal.id)}
                          onMoveStage={(stage) => handleMoveStage(deal.id, stage)}
                        />
                      ))}
                      {(opportunities[key] || []).length === 0 && (
                        <div className="text-center py-4 text-xs text-gray-400">No deals</div>
                      )}
                      {key === 'lead' && (
                        <button onClick={() => setShowCreateModal(true)} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-1">
                          <Plus className="w-3 h-3" /> Add Deal
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ══ LIST VIEW ══ */}
            {view === 'list' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Deal', 'Customer', 'Stage', 'Value', 'Prob', 'Route', 'Assigned', 'Close Date', 'Actions'].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeals.map(deal => (
                        <tr key={deal.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <Link href={`/sales/${deal.id}`} className="font-medium text-blue-600 hover:underline">{deal.title}</Link>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-xs">{deal.customer_name}</td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={{ background: STAGE_COLORS[deal.stage] + '20', color: STAGE_COLORS[deal.stage] }}>
                              {deal.stage}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-emerald-600">{fmt(Number(deal.value))}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${deal.probability}%`, background: STAGE_COLORS[deal.stage] }} />
                              </div>
                              <span className="text-xs text-gray-500">{deal.probability}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">
                            {deal.origin_country && deal.destination_country ? `${deal.origin_country} → ${deal.destination_country}` : '—'}
                            {deal.shipping_mode && <span className="ml-1">{SHIPPING_ICONS[deal.shipping_mode]}</span>}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-500">{deal.assigned_to_name || '—'}</td>
                          <td className="py-3 px-4 text-xs text-gray-500">
                            {deal.expected_close_date ? format(new Date(deal.expected_close_date), 'MMM d, yy') : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <Link href={`/sales/${deal.id}`} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-3.5 h-3.5" /></Link>
                              <button onClick={() => setEditingDeal(deal)} className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredDeals.length === 0 && (
                        <tr><td colSpan={9} className="py-12 text-center text-gray-400">No deals found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══ MY CUSTOMERS VIEW ══ */}
            {view === 'customers' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    {isAdmin ? 'All Customers' : 'My Customer Portfolio'}
                    <span className="text-sm font-normal text-gray-500">— {myCustomers.length} customers</span>
                  </h2>
                  <Link href="/customers" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    Manage All <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {myCustomers.map(cust => (
                    <Link key={cust.id} href={`/customers/${cust.id}`}
                      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow hover:border-blue-300">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                            {cust.company_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm leading-tight">{cust.company_name}</p>
                            <p className="text-xs text-gray-500">{cust.industry || 'General'}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cust.status === 'active' ? 'bg-emerald-100 text-emerald-700' : cust.status === 'prospect' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {cust.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-gray-800">{cust.deal_count || 0}</div>
                          <div className="text-xs text-gray-400">Deals</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-gray-800">{cust.shipment_count || 0}</div>
                          <div className="text-xs text-gray-400">Shipments</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-sm font-bold text-emerald-600">{fmt(cust.revenue || 0)}</div>
                          <div className="text-xs text-gray-400">Revenue</div>
                        </div>
                      </div>
                      {cust.country && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                          <Globe className="w-3 h-3" />{cust.country}
                        </div>
                      )}
                    </Link>
                  ))}
                  {myCustomers.length === 0 && (
                    <div className="col-span-3 py-12 text-center text-gray-400">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No customers assigned yet</p>
                      <Link href="/customers" className="text-blue-600 hover:underline text-sm mt-1 inline-block">Go to Customers →</Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Delete Confirm ── */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div><h3 className="font-semibold text-gray-900">Mark as Lost?</h3><p className="text-sm text-gray-500">This will move the deal to Lost stage.</p></div>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeletingId(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleDelete(deletingId)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modals ── */}
        {showCreateModal && (
          <DealFormModal customers={customers} onSave={handleCreate} onClose={() => setShowCreateModal(false)} />
        )}
        {editingDeal && (
          <DealFormModal customers={customers} onSave={handleEdit} onClose={() => setEditingDeal(null)} initial={editingDeal} />
        )}

        <Toasts list={toasts} remove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      </div>
    </MainLayout>
  );
}
