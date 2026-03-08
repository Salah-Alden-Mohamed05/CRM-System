'use client';
import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { customersAPI, dealsAPI, tasksAPI, documentsAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Filter, RefreshCw, Users, Building2, Globe, Phone,
  Mail, Edit3, Trash2, Eye, X, CheckCircle2, AlertCircle, Star,
  TrendingUp, DollarSign, Package, Calendar, ChevronDown, ChevronUp,
  Tag, MapPin, Briefcase, ClipboardList, Paperclip, FileText, ChevronRight,
  UserPlus, Activity, BarChart2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  company_name: string;
  industry?: string;
  country?: string;
  city?: string;
  status: string;
  website?: string;
  tax_id?: string;
  credit_limit?: number;
  payment_terms?: number;
  notes?: string;
  assigned_to_name?: string;
  shipment_count?: number;
  opportunity_count?: number;
  total_revenue?: number;
  created_at: string;
}

const STATUS_CONFIG = {
  active:   { label: 'Active',   labelAr: 'نشط',     color: 'bg-green-100 text-green-700 border-green-200' },
  inactive: { label: 'Inactive', labelAr: 'غير نشط', color: 'bg-gray-100 text-gray-600 border-gray-200'   },
  prospect: { label: 'Prospect', labelAr: 'محتمل',   color: 'bg-blue-100 text-blue-700 border-blue-200'   },
};

const INDUSTRIES = [
  'Manufacturing','Retail','Pharmaceuticals','Electronics','Commodities',
  'Automotive','Food & Beverage','Chemicals','Construction','Oil & Gas',
  'Textiles','Technology','Healthcare','Other',
];

// ─── Customer Form Modal ──────────────────────────────────────────────────────
function CustomerFormModal({ customer, onSave, onClose }: {
  customer?: Customer; onSave: (data: any) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    companyName: customer?.company_name || '',
    industry: customer?.industry || '',
    country: customer?.country || '',
    city: customer?.city || '',
    website: customer?.website || '',
    taxId: customer?.tax_id || '',
    status: customer?.status || 'prospect',
    notes: customer?.notes || '',
    creditLimit: customer?.credit_limit?.toString() || '',
    paymentTerms: customer?.payment_terms?.toString() || '30',
    phone: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.companyName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        companyName: form.companyName,
        industry: form.industry || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
        website: form.website || undefined,
        taxId: form.taxId || undefined,
        status: form.status,
        notes: form.notes || undefined,
        creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
        paymentTerms: form.paymentTerms ? parseInt(form.paymentTerms) : 30,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{customer ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name *</label>
            <input type="text" value={form.companyName}
              onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              placeholder="e.g. Global Trade Corp"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Industry</label>
              <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">— Select —</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Country</label>
              <input type="text" value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                placeholder="UAE" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
              <input type="text" value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Dubai" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Website</label>
              <input type="text" value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://company.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tax ID</label>
              <input type="text" value={form.taxId}
                onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))}
                placeholder="12-3456789" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Credit Limit (USD)</label>
              <input type="number" value={form.creditLimit}
                onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))}
                placeholder="50000" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Terms (days)</label>
              <input type="number" value={form.paymentTerms}
                onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                placeholder="30" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Long-term relationship notes, preferences, important details..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.companyName.trim()}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : customer ? 'Update Customer' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customer Card ─────────────────────────────────────────────────────────────
function CustomerCard({ customer, onView, onEdit, onDelete }: {
  customer: Customer;
  onView: (c: Customer) => void;
  onEdit: (c: Customer) => void;
  onDelete: (id: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[customer.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.prospect;
  const revenue = Number(customer.total_revenue || 0);
  const initials = customer.company_name.slice(0, 2).toUpperCase();

  // Color based on status
  const avatarColor = customer.status === 'active'
    ? 'from-green-500 to-emerald-600'
    : customer.status === 'prospect'
    ? 'from-blue-500 to-blue-600'
    : 'from-gray-400 to-gray-500';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-blue-200 transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 bg-gradient-to-br ${avatarColor} rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
            {initials}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{customer.company_name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{customer.industry || 'General'}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Location */}
      {(customer.country || customer.city) && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>{[customer.city, customer.country].filter(Boolean).join(', ')}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl mb-4">
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">{customer.shipment_count || 0}</div>
          <div className="text-xs text-gray-500 mt-0.5">Shipments</div>
        </div>
        <div className="text-center border-x border-gray-200">
          <div className="text-sm font-bold text-gray-900">{customer.opportunity_count || 0}</div>
          <div className="text-xs text-gray-500 mt-0.5">Deals</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">
            {revenue > 0 ? `$${(revenue / 1000).toFixed(0)}k` : '$0'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Revenue</div>
        </div>
      </div>

      {/* Notes preview */}
      {customer.notes && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-3 italic">"{customer.notes}"</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          {customer.assigned_to_name ? `Managed by ${customer.assigned_to_name}` : 'Unassigned'}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onView(customer)}
            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="View History">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(customer)}
            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Edit">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(customer.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customer Detail Side Panel ───────────────────────────────────────────────
function CustomerDetailPanel({ customer, onClose, onEdit }: {
  customer: Customer; onClose: () => void; onEdit: (c: Customer) => void;
}) {
  const router = useRouter();
  const [deals, setDeals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'deals' | 'tasks' | 'documents'>('overview');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dealsRes, tasksRes, docsRes] = await Promise.all([
          dealsAPI.getAll({ customerId: customer.id, limit: 50 }).catch(() => ({ data: { data: [] } })),
          tasksAPI.getAll({ customerId: customer.id, limit: 50 }).catch(() => ({ data: { data: [] } })),
          documentsAPI.getAll({ customerId: customer.id }).catch(() => ({ data: { data: [] } })),
        ]);
        setDeals(dealsRes.data?.data || []);
        setTasks(tasksRes.data?.data || []);
        setDocs(docsRes.data?.data || []);
      } finally { setLoading(false); }
    };
    load();
  }, [customer.id]);

  const statusCfg = STATUS_CONFIG[customer.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.prospect;
  const revenue = Number(customer.total_revenue || 0);
  const initials = customer.company_name.slice(0, 2).toUpperCase();

  const STAGE_COLORS: Record<string,string> = {
    lead:'bg-slate-100 text-slate-700', contacted:'bg-blue-100 text-blue-700',
    rfq:'bg-violet-100 text-violet-700', quotation:'bg-amber-100 text-amber-700',
    negotiation:'bg-orange-100 text-orange-700', won:'bg-green-100 text-green-700',
    lost:'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-end z-50">
      <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{customer.company_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
                {customer.industry && (
                  <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border">{customer.industry}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(customer)}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-0 border-b border-gray-100">
          {[
            { label: 'Total Deals', val: deals.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Revenue', val: revenue > 0 ? `$${(revenue/1000).toFixed(0)}k` : '$0', color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Tasks', val: tasks.length, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map((s, i) => (
            <div key={s.label} className={`${s.bg} p-4 text-center ${i > 0 ? 'border-l border-gray-100' : ''}`}>
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { key: 'overview', label: 'Overview', icon: Building2 },
            { key: 'deals', label: `Deals (${deals.length})`, icon: Briefcase },
            { key: 'tasks', label: `Tasks (${tasks.length})`, icon: ClipboardList },
            { key: 'documents', label: `Docs (${docs.length})`, icon: Paperclip },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 flex-1 justify-center transition-all ${
                tab === t.key ? 'border-blue-500 text-blue-600 bg-blue-50/30' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Country', val: customer.country, icon: Globe },
                      { label: 'City', val: customer.city, icon: MapPin },
                      { label: 'Website', val: customer.website, icon: FileText },
                      { label: 'Tax ID', val: customer.tax_id, icon: Tag },
                      { label: 'Credit Limit', val: customer.credit_limit ? `$${customer.credit_limit.toLocaleString()}` : undefined, icon: DollarSign },
                      { label: 'Payment Terms', val: customer.payment_terms ? `${customer.payment_terms} days` : undefined, icon: Calendar },
                    ].filter(f => f.val).map(f => (
                      <div key={f.label} className="flex items-start gap-2">
                        <f.icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-gray-400">{f.label}</div>
                          <div className="font-medium text-gray-800 text-xs mt-0.5">{f.val}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {customer.notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Relationship Notes
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{customer.notes}</p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="border border-gray-200 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-gray-600 mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => router.push(`/deals?customerId=${customer.id}`)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                        <Briefcase className="w-3.5 h-3.5" /> View Deals
                      </button>
                      <button onClick={() => router.push(`/rfqs?customerId=${customer.id}`)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100">
                        <FileText className="w-3.5 h-3.5" /> View RFQs
                      </button>
                      <button onClick={() => router.push(`/customers/${customer.id}`)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
                        <Eye className="w-3.5 h-3.5" /> Full Profile
                      </button>
                      <button onClick={() => router.push(`/tasks?customerId=${customer.id}`)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100">
                        <ClipboardList className="w-3.5 h-3.5" /> View Tasks
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Deals Tab */}
              {tab === 'deals' && (
                <div className="space-y-3">
                  <button onClick={() => router.push('/deals')}
                    className="w-full flex items-center justify-center gap-2 py-2 text-xs text-blue-600 bg-blue-50 border border-dashed border-blue-300 rounded-lg hover:bg-blue-100">
                    <Plus className="w-3.5 h-3.5" /> New Deal for this Customer
                  </button>
                  {deals.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No deals yet</p>
                    </div>
                  ) : deals.map(deal => (
                    <div key={deal.id} onClick={() => router.push(`/deals/${deal.id}`)}
                      className="p-3 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50/20 cursor-pointer transition-all">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-mono text-gray-400">{deal.deal_number}</span>
                          <p className="text-sm font-medium text-gray-800 mt-0.5">{deal.title}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[deal.stage] || 'bg-gray-100 text-gray-700'}`}>
                          {deal.stage}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{deal.currency} {Number(deal.value||0).toLocaleString()}</span>
                        <span>{deal.probability}% prob.</span>
                        {deal.origin_country && <span>{deal.origin_country} → {deal.destination_country}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks Tab */}
              {tab === 'tasks' && (
                <div className="space-y-2">
                  {tasks.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No tasks for this customer</p>
                    </div>
                  ) : tasks.map(task => (
                    <div key={task.id} className="p-3 border border-gray-200 rounded-xl">
                      <div className="flex items-start justify-between">
                        <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {task.title}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          task.status === 'completed' ? 'bg-green-100 text-green-700' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{task.status.replace('_',' ')}</span>
                      </div>
                      {task.due_date && (
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Documents Tab */}
              {tab === 'documents' && (
                <div className="space-y-2">
                  {docs.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No documents attached</p>
                    </div>
                  ) : docs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
                      <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400">{doc.document_category} · {new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { user } = useAuth();
  const isAdmin = ['Admin'].includes(user?.role || '');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [total, setTotal] = useState(0);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customersAPI.getAll({
        search: search || undefined,
        status: filterStatus || undefined,
        limit: 200,
      });
      const data = res.data?.data || [];
      setCustomers(data);
      setTotal(res.data?.total || data.length);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, filterStatus]);

  useEffect(() => {
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await customersAPI.create(data);
      await fetchData();
      setShowCreateModal(false);
      showToast('Customer added!');
    } catch { showToast('Failed to create customer', 'error'); }
  };

  const handleUpdate = async (data: any) => {
    if (!editingCustomer) return;
    try {
      await customersAPI.update(editingCustomer.id, data);
      await fetchData();
      setEditingCustomer(null);
      showToast('Customer updated!');
    } catch { showToast('Failed to update customer', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await customersAPI.delete(id);
      await fetchData();
      setDeletingId(null);
      showToast('Customer deleted');
    } catch { showToast('Cannot delete — customer has linked data', 'error'); }
  };

  // Filter by industry locally
  const filtered = customers.filter(c => {
    if (filterIndustry && c.industry !== filterIndustry) return false;
    return true;
  });

  // Summary stats
  const active = customers.filter(c => c.status === 'active').length;
  const prospects = customers.filter(c => c.status === 'prospect').length;
  const totalRevenue = customers.reduce((s, c) => s + Number(c.total_revenue || 0), 0);

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customer Relationship Tracker</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Long-term customer history, deals, and relationship management
            </p>
          </div>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm">
            <UserPlus className="w-4 h-4" /> Add Customer
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Customers', val: total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active Clients', val: active, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Prospects', val: prospects, icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Total Revenue', val: totalRevenue > 0 ? `$${(totalRevenue/1000).toFixed(0)}k` : '$0', icon: DollarSign, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white shadow-sm`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">{s.label}</span>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search customers by name, country, industry..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">All Status</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
                <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">All Industries</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => { setFilterStatus(''); setFilterIndustry(''); setSearch(''); }}
                  className="w-full px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: '', label: `All (${customers.length})` },
            { key: 'active', label: `Active (${active})` },
            { key: 'prospect', label: `Prospects (${prospects})` },
            { key: 'inactive', label: `Inactive (${customers.filter(c => c.status === 'inactive').length})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                filterStatus === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Customer Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-500 mb-1">No customers found</h3>
            <p className="text-sm text-gray-400 mb-4">
              Tip: Add customers from the Sales Pipeline when creating deals
            </p>
            <button onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add First Customer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(customer => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onView={c => setViewingCustomer(c)}
                onEdit={c => setEditingCustomer(c)}
                onDelete={id => setDeletingId(id)}
              />
            ))}
          </div>
        )}

        {/* Modals */}
        {showCreateModal && (
          <CustomerFormModal onSave={handleCreate} onClose={() => setShowCreateModal(false)} />
        )}
        {editingCustomer && (
          <CustomerFormModal
            customer={editingCustomer}
            onSave={handleUpdate}
            onClose={() => setEditingCustomer(null)}
          />
        )}
        {viewingCustomer && (
          <CustomerDetailPanel
            customer={viewingCustomer}
            onClose={() => setViewingCustomer(null)}
            onEdit={c => { setViewingCustomer(null); setEditingCustomer(c); }}
          />
        )}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Customer?</h3>
              <p className="text-sm text-gray-500 mb-5">
                This will also remove all linked contacts. Deals and shipments will be unlinked.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setDeletingId(null)}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deletingId)}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
