'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { salesAPI, authAPI } from '@/lib/api';
import Link from 'next/link';
import {
  Users, Plus, Search, Filter, RefreshCw, Eye, Edit2, Trash2,
  UserCheck, UserX, TrendingUp, Phone, Mail, Building2,
  ChevronDown, X, Check, AlertCircle, ArrowRight, UserPlus,
  Upload, Shuffle
} from 'lucide-react';

interface Lead {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'disqualified';
  notes: string;
  assigned_to: string;
  assigned_to_name: string;
  assigned_to_email: string;
  created_by: string;
  created_by_name: string;
  converted_to_customer: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-800', icon: Plus },
  contacted: { label: 'Contacted', color: 'bg-yellow-100 text-yellow-800', icon: Phone },
  qualified: { label: 'Qualified', color: 'bg-green-100 text-green-800', icon: Check },
  disqualified: { label: 'Disqualified', color: 'bg-red-100 text-red-800', icon: X },
};

const SOURCE_OPTIONS = ['website', 'referral', 'cold_call', 'email', 'social_media', 'trade_show', 'partner', 'other'];

export default function AdminLeadsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (assignedToFilter) params.assignedTo = assignedToFilter;
      const res = await salesAPI.getLeads(params);
      if (res.data.success) {
        setLeads(res.data.data);
        setTotal(res.data.total);
        setStatusSummary(res.data.statusSummary || {});
      }
    } catch (err) {
      addToast('Failed to fetch leads', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, assignedToFilter]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.role !== 'Admin') { router.push('/dashboard'); return; }
    fetchLeads();
  }, [isAuthenticated, user, fetchLeads, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await authAPI.getUsers({ limit: 100, role: 'Sales' });
        if (res.data.success) setUsers(res.data.data);
      } catch {}
    };
    if (isAuthenticated) fetchUsers();
  }, [isAuthenticated]);

  const handleDelete = async () => {
    if (!selectedLead) return;
    try {
      await salesAPI.deleteLead(selectedLead.id);
      addToast('Lead deleted successfully');
      setShowDeleteModal(false);
      setSelectedLead(null);
      fetchLeads();
    } catch {
      addToast('Failed to delete lead', 'error');
    }
  };

  const handleAssign = async (leadId: string, assignedTo: string) => {
    try {
      await salesAPI.updateLead(leadId, { assignedTo });
      addToast('Lead assigned successfully');
      setShowAssignModal(false);
      fetchLeads();
    } catch {
      addToast('Failed to assign lead', 'error');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-blue-600" />
              Lead Database
            </h1>
            <p className="text-gray-500 mt-1">Manage and distribute leads to your sales team</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/admin/leads/import"
              className="flex items-center gap-2 px-3 py-2 border border-green-300 text-green-700 bg-green-50 rounded-lg hover:bg-green-100 text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Import
            </Link>
            <Link
              href="/admin/leads/distribution"
              className="flex items-center gap-2 px-3 py-2 border border-purple-300 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 text-sm font-medium"
            >
              <Shuffle className="w-4 h-4" />
              Distribute
            </Link>
            <button
              onClick={fetchLeads}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => { setSelectedLead(null); setShowCreateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Lead
            </button>
          </div>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div
                key={key}
                onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
                className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
                  statusFilter === key ? 'border-blue-500 shadow-md' : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{statusSummary[key] || 0}</div>
                <div className="text-xs text-gray-500">leads</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by company, contact, email..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={assignedToFilter}
              onChange={e => { setAssignedToFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sales Reps</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
            {(search || statusFilter || assignedToFilter) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setAssignedToFilter(''); setPage(1); }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-2/3"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
                      <td className="py-4 px-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                      <td className="py-4 px-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="py-4 px-4"><div className="h-8 bg-gray-200 rounded w-24 ml-auto"></div></td>
                    </tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No leads found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or create a new lead</p>
                    </td>
                  </tr>
                ) : leads.map(lead => {
                  const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                            {lead.company_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{lead.company_name}</div>
                            {lead.converted_to_customer && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Converted
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-gray-900">{lead.contact_name || '—'}</div>
                        {lead.email && <div className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</div>}
                        {lead.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 capitalize">{lead.source || '—'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {lead.assigned_to_name ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{lead.assigned_to_name}</div>
                            <div className="text-xs text-gray-500">{lead.assigned_to_email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setSelectedLead(lead); setShowAssignModal(true); }}
                            title="Assign to sales rep"
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedLead(lead); setShowEditModal(true); }}
                            title="Edit lead"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedLead(lead); setShowDeleteModal(true); }}
                            title="Delete lead"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-600">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} leads
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Lead Modal */}
      {(showCreateModal || showEditModal) && (
        <LeadModal
          lead={showEditModal ? selectedLead : null}
          users={users}
          onClose={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedLead(null); }}
          onSave={async (data) => {
            try {
              if (showEditModal && selectedLead) {
                await salesAPI.updateLead(selectedLead.id, data);
                addToast('Lead updated successfully');
              } else {
                await salesAPI.createLead(data);
                addToast('Lead created successfully');
              }
              setShowCreateModal(false);
              setShowEditModal(false);
              setSelectedLead(null);
              fetchLeads();
            } catch {
              addToast('Failed to save lead', 'error');
            }
          }}
        />
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedLead && (
        <AssignModal
          lead={selectedLead}
          users={users}
          onClose={() => { setShowAssignModal(false); setSelectedLead(null); }}
          onAssign={handleAssign}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Delete Lead</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedLead.company_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setSelectedLead(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${
            t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            <Check className="w-4 h-4" />
            {t.message}
          </div>
        ))}
      </div>
    </MainLayout>
  );
}

// ─── LeadModal Component ──────────────────────────────────────────────────────
function LeadModal({
  lead, users, onClose, onSave
}: {
  lead: Lead | null;
  users: User[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    companyName: lead?.company_name || '',
    contactName: lead?.contact_name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    source: lead?.source || '',
    notes: lead?.notes || '',
    status: lead?.status || 'new',
    assignedTo: lead?.assigned_to || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.companyName.trim()) { setError('Company name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {lead ? 'Edit Lead' : 'Create New Lead'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
            <input
              type="text"
              value={form.companyName}
              onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Enter company name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input
                type="text"
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="+1 234 567 890"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="contact@company.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select source</option>
                {SOURCE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as 'new' | 'contacted' | 'qualified' | 'disqualified' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="disqualified">Disqualified</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
            <select
              value={form.assignedTo}
              onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add any relevant notes..."
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {lead ? 'Save Changes' : 'Create Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AssignModal Component ────────────────────────────────────────────────────
function AssignModal({
  lead, users, onClose, onAssign
}: {
  lead: Lead;
  users: User[];
  onClose: () => void;
  onAssign: (leadId: string, userId: string) => void;
}) {
  const [selectedUser, setSelectedUser] = useState(lead.assigned_to || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Assign Lead</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">Lead: <strong>{lead.company_name}</strong></p>
          {lead.assigned_to_name && (
            <p className="text-sm text-gray-500">Currently assigned to: {lead.assigned_to_name}</p>
          )}
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Sales Rep</label>
          <select
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a rep...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => selectedUser && onAssign(lead.id, selectedUser)}
            disabled={!selectedUser}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Assign
          </button>
        </div>
      </div>
    </div>
  );
}
