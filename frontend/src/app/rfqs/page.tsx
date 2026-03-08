'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { rfqsAPI, customersAPI, dealsAPI } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Search, Filter, RefreshCw, FileText, ChevronDown, ChevronUp,
  X, CheckCircle2, AlertCircle, Edit3, Eye, Globe, Ship, Plane, Package,
  Building2, Calendar, Tag, ExternalLink, ArrowRight
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700' },
  sent_to_ops: { label: 'Sent to Ops',color: 'bg-blue-100 text-blue-700' },
  pricing:     { label: 'Pricing',    color: 'bg-violet-100 text-violet-700' },
  quoted:      { label: 'Quoted',     color: 'bg-green-100 text-green-700' },
  approved:    { label: 'Approved',   color: 'bg-emerald-100 text-emerald-700' },
  rejected:    { label: 'Rejected',   color: 'bg-red-100 text-red-700' },
};

function RFQsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillDealId = searchParams.get('dealId');
  const isAdmin = ['Admin', 'Finance', 'Operations'].includes(user?.role || '');

  const [rfqs, setRfqs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(!!prefillDealId);
  const [selectedRFQ, setSelectedRFQ] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rfqsRes, custRes, dealsRes] = await Promise.all([
        rfqsAPI.getAll({ limit: 200, status: filterStatus || undefined }),
        customersAPI.getAll({ limit: 200 }),
        dealsAPI.getAll({ limit: 200 }),
      ]);
      setRfqs(rfqsRes.data?.data || []);
      setCustomers(custRes.data?.data || []);
      setDeals(dealsRes.data?.data || []);
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await rfqsAPI.update(id, { status });
      await fetchData();
      showToast('RFQ status updated!');
    } catch { showToast('Failed', 'error'); }
  };

  const filtered = rfqs.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.rfq_number?.toLowerCase().includes(s) ||
      r.customer_name?.toLowerCase().includes(s) ||
      r.origin_country?.toLowerCase().includes(s) ||
      r.destination_country?.toLowerCase().includes(s);
  });

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RFQ Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Request for Quotation — logistics pricing requests</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 shadow-sm">
            <Plus className="w-4 h-4" /> New RFQ
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = rfqs.filter(r => r.status === key).length;
            return (
              <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                className={`p-3 rounded-xl border text-center transition-all ${filterStatus === key ? 'border-violet-400 bg-violet-50' : 'bg-white border-gray-200 hover:border-violet-200'}`}>
                <div className="text-xl font-bold text-gray-800">{count}</div>
                <div className={`text-xs font-medium mt-1 px-1.5 py-0.5 rounded-full inline-block ${cfg.color}`}>{cfg.label}</div>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by RFQ#, customer, route..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400" />
        </div>

        {/* RFQ List */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 text-violet-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No RFQs found</p>
            <button onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-violet-600 hover:underline">Create your first RFQ →</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(rfq => {
              const statusCfg = STATUS_CONFIG[rfq.status] || STATUS_CONFIG.pending;
              return (
                <div key={rfq.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-violet-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-bold font-mono text-gray-500">{rfq.rfq_number}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                        {rfq.deal_title && (
                          <span className="text-xs text-gray-400">Deal: {rfq.deal_number}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700 font-medium mb-3">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {rfq.customer_name}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Globe className="w-3.5 h-3.5 text-gray-400" />
                          <span>{rfq.origin_country} <ArrowRight className="w-3 h-3 inline" /> {rfq.destination_country}</span>
                        </div>
                        {rfq.origin_port && (
                          <div className="text-gray-500 text-xs">{rfq.origin_port} → {rfq.destination_port}</div>
                        )}
                        {rfq.shipping_mode && (
                          <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <Ship className="w-3 h-3" /> {rfq.shipping_mode}
                          </div>
                        )}
                        {rfq.weight_kg && <div className="text-xs text-gray-500">Weight: {rfq.weight_kg} kg</div>}
                        {rfq.volume_cbm && <div className="text-xs text-gray-500">Volume: {rfq.volume_cbm} CBM</div>}
                        {rfq.cargo_type && <div className="text-xs text-gray-500">Cargo: {rfq.cargo_type}</div>}
                        {rfq.service_type && <div className="text-xs text-gray-500">Service: {rfq.service_type}</div>}
                        {rfq.incoterms && <div className="text-xs text-gray-500">Incoterms: {rfq.incoterms}</div>}
                      </div>
                      <div className="flex gap-3 mt-2">
                        {rfq.hazardous && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">⚠️ Hazardous</span>}
                        {rfq.temperature_controlled && <span className="text-xs bg-cyan-100 text-cyan-600 px-2 py-0.5 rounded">❄️ Temp Controlled</span>}
                        {rfq.insurance_required && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">🛡 Insurance</span>}
                        {rfq.customs_clearance_required && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">📋 Customs</span>}
                      </div>
                      {rfq.special_instructions && (
                        <p className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg line-clamp-2">{rfq.special_instructions}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <div className="text-xs text-gray-400">{new Date(rfq.created_at).toLocaleDateString()}</div>
                      {isAdmin && (
                        <select value={rfq.status}
                          onChange={e => handleStatusUpdate(rfq.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-violet-400">
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      )}
                      {rfq.deal_id && (
                        <button onClick={() => router.push(`/deals/${rfq.deal_id}`)}
                          className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                          View Deal <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cargo ready / delivery dates */}
                  {(rfq.cargo_ready_date || rfq.required_delivery_date) && (
                    <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      {rfq.cargo_ready_date && (
                        <span><Calendar className="w-3 h-3 inline mr-1" />Ready: {new Date(rfq.cargo_ready_date).toLocaleDateString()}</span>
                      )}
                      {rfq.required_delivery_date && (
                        <span><Calendar className="w-3 h-3 inline mr-1" />Required By: {new Date(rfq.required_delivery_date).toLocaleDateString()}</span>
                      )}
                      <span className="ml-auto">Submitted by: {rfq.submitted_by_name || '—'}</span>
                    </div>
                  )}

                  {/* Custom Fields */}
                  {rfq.custom_fields && Object.keys(rfq.custom_fields).some(k => rfq.custom_fields[k]) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(rfq.custom_fields).filter(([, v]) => v).map(([k, v]) => (
                          <span key={k} className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded">
                            {k.replace('customField', 'Field ')}: {String(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

export default function RFQsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><RefreshCw className="w-8 h-8 text-violet-500 animate-spin" /></div>}>
      <RFQsContent />
    </Suspense>
  );
}
