'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { salesAPI, customersAPI } from '@/lib/api';
import { Loading } from '@/components/ui';
import {
  Plus, Search, RefreshCw, Star, Phone, Mail, Globe,
  CheckCircle, XCircle, X, AlertTriangle, ArrowRight,
  UserPlus, Calendar, MessageSquare, Target, ChevronRight,
  Edit2, Trash2, TrendingUp, Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  source?: string;
  status: 'new' | 'contacted' | 'qualified' | 'disqualified';
  notes?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  converted_to_customer?: string;
  converted_at?: string;
  created_at: string;
  updated_at: string;
}

interface Toast { id: string; msg: string; type: 'success' | 'error'; }

// ─── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  new:           { label: 'New',           color: 'bg-gray-100 text-gray-700 border-gray-200',   dot: 'bg-gray-400' },
  contacted:     { label: 'Contacted',     color: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-500' },
  qualified:     { label: 'Qualified',     color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  disqualified:  { label: 'Disqualified',  color: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-500' },
};

const SOURCE_ICONS: Record<string, string> = {
  website: '🌐', referral: '👥', cold_call: '📞', email: '📧',
  linkedin: '💼', trade_show: '🏢', other: '📌',
};

// ─── Toast ─────────────────────────────────────────────────────────────────────
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

// ─── Lead Form Modal ───────────────────────────────────────────────────────────
function LeadFormModal({
  onSave, onClose, initial
}: {
  onSave: (data: Record<string, string>) => Promise<void>;
  onClose: () => void;
  initial?: Partial<Lead>;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    companyName: initial?.company_name || '',
    contactName: initial?.contact_name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    source: initial?.source || '',
    status: initial?.status || 'new',
    notes: initial?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) { setErr('Company name is required'); return; }
    setSaving(true);
    try { await onSave(form); }
    catch (e: unknown) { setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            {isEdit ? 'Edit Lead' : 'New Lead'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2"><XCircle className="w-4 h-4" />{err}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="ABC Logistics Inc." required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                <option value="">Select source</option>
                {Object.entries(SOURCE_ICONS).map(([key, icon]) => (
                  <option key={key} value={key}>{icon} {key.replace('_', ' ').charAt(0).toUpperCase() + key.replace('_', ' ').slice(1)}</option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contact@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 555 000 0000" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Initial contact notes, requirements, next steps..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-60 flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Convert to Deal Modal ─────────────────────────────────────────────────────
function ConvertModal({
  lead, customers, onConvert, onClose
}: {
  lead: Lead;
  customers: Array<{ id: string; company_name: string }>;
  onConvert: (dealData: Record<string, string | number>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: `${lead.company_name} - Logistics`,
    customerId: '',
    stage: 'lead',
    value: '',
    shippingMode: '',
    originCountry: '',
    destinationCountry: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setErr('Deal title is required'); return; }
    setSaving(true);
    try {
      await onConvert({
        ...form,
        value: parseFloat(form.value) || 0,
      });
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to convert');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Convert Lead to Deal
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Star className="w-4 h-4 text-yellow-500" />
            <span>Converting lead: <strong>{lead.company_name}</strong></span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deal Title *</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Existing Customer (optional)</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Create new customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value (USD)</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="25000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Mode</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.shippingMode} onChange={e => setForm({ ...form, shippingMode: e.target.value })}>
                <option value="">Select mode</option>
                {['sea', 'air', 'road', 'rail', 'multimodal'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
                {['lead', 'contacted', 'rfq', 'quotation', 'negotiation'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <TrendingUp className="w-4 h-4" /> Convert to Deal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main My Leads Page ────────────────────────────────────────────────────────
export default function MyLeadsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; company_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, custRes] = await Promise.all([
        salesAPI.getLeads(),
        customersAPI.getAll({ limit: 200 }),
      ]);
      setLeads(leadsRes.data.data as Lead[]);
      setCustomers((custRes.data.data as Array<{ id: string; company_name: string }>));
    } catch {
      addToast('Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.replace('/login'); return; }
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, authLoading, router, fetchData]);

  const handleCreate = async (data: Record<string, string>) => {
    await salesAPI.createLead({ ...data, assignedTo: user?.id });
    setShowCreateModal(false);
    addToast('Lead added successfully');
    fetchData();
  };

  const handleUpdate = async (data: Record<string, string>) => {
    if (!editingLead) return;
    await salesAPI.updateLead(editingLead.id, data);
    setEditingLead(null);
    addToast('Lead updated');
    fetchData();
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await salesAPI.updateLead(id, { status });
      addToast(`Lead status changed to ${status}`);
      fetchData();
    } catch {
      addToast('Failed to update status', 'error');
    }
  };

  const handleConvert = async (dealData: Record<string, string | number>) => {
    if (!convertingLead) return;
    // Create deal linked to lead
    await salesAPI.createOpportunity({
      ...dealData,
      notes: `Converted from lead: ${convertingLead.company_name}`,
      assignedTo: user?.id,
    });
    setConvertingLead(null);
    addToast(`Lead converted to deal!`);
    router.push('/sales');
  };

  const filteredLeads = leads.filter(l => {
    const matchSearch = !search ||
      l.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.contact_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    acc[key] = leads.filter(l => l.status === key).length;
    return acc;
  }, {} as Record<string, number>);

  if (authLoading) return <MainLayout><div className="p-8"><Loading /></div></MainLayout>;

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/sales" className="hover:text-blue-600 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />Sales
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-medium text-gray-700">My Leads</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-500" />
              {isAdmin ? 'All Leads' : 'My Leads'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{leads.length} total leads · {statusCounts.qualified || 0} qualified</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg">
              <RefreshCw className="w-4 h-4" />Refresh
            </button>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600">
              <Plus className="w-4 h-4" />New Lead
            </button>
          </div>
        </div>

        {/* Status Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`text-center p-3 rounded-xl border-2 transition-all hover:shadow-md ${statusFilter === key ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-xs font-medium text-gray-600">{cfg.label}</span>
              </div>
              <p className="font-bold text-xl text-gray-900">{statusCounts[key] || 0}</p>
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loading /></div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Star className="w-12 h-12 text-gray-200 mb-4" />
            <p className="text-gray-500 font-medium">No leads found</p>
            <p className="text-gray-400 text-sm mt-1">Create your first lead to start building your pipeline</p>
            <button onClick={() => setShowCreateModal(true)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600">
              <Plus className="w-4 h-4" />Add First Lead
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLeads.map(lead => {
              const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
              return (
                <div key={lead.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {lead.company_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{lead.company_name}</p>
                        {lead.contact_name && <p className="text-xs text-gray-500">{lead.contact_name}</p>}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1 mb-3">
                    {lead.email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />
                        <a href={`mailto:${lead.email}`} className="hover:text-blue-600 truncate">{lead.email}</a>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Phone className="w-3 h-3" />
                        <a href={`tel:${lead.phone}`} className="hover:text-blue-600">{lead.phone}</a>
                      </div>
                    )}
                    {lead.source && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Globe className="w-3 h-3" />
                        <span>{SOURCE_ICONS[lead.source] || '📌'} {lead.source.replace('_', ' ')}</span>
                      </div>
                    )}
                  </div>

                  {lead.notes && (
                    <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 line-clamp-2">{lead.notes}</p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                    <Calendar className="w-3 h-3" />
                    <span>Added {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-gray-50 pt-3">
                    {/* Quick status change */}
                    {lead.status === 'new' && (
                      <button onClick={() => handleStatusChange(lead.id, 'contacted')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                        <Phone className="w-3 h-3" />Mark Contacted
                      </button>
                    )}
                    {lead.status === 'contacted' && (
                      <button onClick={() => handleStatusChange(lead.id, 'qualified')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors">
                        <CheckCircle className="w-3 h-3" />Qualify
                      </button>
                    )}
                    {lead.status === 'qualified' && (
                      <button onClick={() => setConvertingLead(lead)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
                        <TrendingUp className="w-3 h-3" />Convert to Deal
                      </button>
                    )}
                    {lead.status !== 'qualified' && lead.status !== 'disqualified' && (
                      <button onClick={() => setConvertingLead(lead)}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Convert to deal">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => setEditingLead(lead)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {lead.status !== 'disqualified' && (
                      <button onClick={() => handleStatusChange(lead.id, 'disqualified')}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Disqualify">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pipeline conversion hint */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-blue-600" />
            <div>
              <p className="font-semibold text-gray-900 text-sm">Lead → Deal Pipeline</p>
              <p className="text-xs text-gray-600">Qualify leads and convert them to deals to track in the sales pipeline</p>
            </div>
          </div>
          <Link href="/sales" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
            View Pipeline <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Modals */}
        {showCreateModal && <LeadFormModal onSave={handleCreate} onClose={() => setShowCreateModal(false)} />}
        {editingLead && <LeadFormModal onSave={handleUpdate} onClose={() => setEditingLead(null)} initial={editingLead} />}
        {convertingLead && (
          <ConvertModal
            lead={convertingLead}
            customers={customers}
            onConvert={handleConvert}
            onClose={() => setConvertingLead(null)}
          />
        )}

        <Toasts list={toasts} remove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      </div>
    </MainLayout>
  );
}
