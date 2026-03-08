'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { quotationsAPI, customersAPI, dealsAPI, rfqsAPI, documentsAPI } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, RefreshCw, CheckSquare, X, CheckCircle2, AlertCircle,
  DollarSign, Upload, FileText, Building2, Eye, Trash2, ExternalLink,
  Calculator, Calendar, Tag, Edit3
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  expired:  { label: 'Expired',  color: 'bg-orange-100 text-orange-700' },
  revised:  { label: 'Revised',  color: 'bg-violet-100 text-violet-700' },
};

interface QuotationItem { category: string; description: string; quantity: number; unit: string; unitPrice: number; amount: number; }

function QuotationFormModal({ onClose, onCreated, prefillDealId, customers, deals, rfqs }: {
  onClose: () => void; onCreated: () => void;
  prefillDealId?: string; customers: any[]; deals: any[]; rfqs: any[];
}) {
  const [form, setForm] = useState({
    customerId: '',
    dealId: prefillDealId || '',
    rfqId: '',
    validUntil: '',
    currency: 'USD',
    originCharges: 0,
    freightCost: 0,
    destinationCharges: 0,
    customsClearance: 0,
    insurance: 0,
    otherCharges: 0,
    taxRate: 0,
    transitTimeDays: '',
    paymentTerms: '',
    notes: '',
    termsConditions: '',
  });
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const f = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const subtotal = form.originCharges + form.freightCost + form.destinationCharges + form.customsClearance + form.insurance + form.otherCharges;
  const taxAmount = subtotal * (form.taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const addItem = () => setItems(prev => [...prev, { category: 'freight', description: '', quantity: 1, unit: 'shipment', unitPrice: 0, amount: 0 }]);
  const updateItem = (i: number, field: string, value: any) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.amount = Number(updated.quantity) * Number(updated.unitPrice);
      }
      return updated;
    }));
  };
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!form.customerId) return;
    setSaving(true);
    try {
      const res = await quotationsAPI.create({
        ...form,
        rfqId: form.rfqId || undefined,
        dealId: form.dealId || undefined,
        transitTimeDays: form.transitTimeDays ? parseInt(form.transitTimeDays) : undefined,
        items: items.length > 0 ? items : undefined,
      });
      const quotationId = res.data?.data?.id;

      // Upload PDF if attached
      if (pdfFile && quotationId) {
        try {
          const fd = new FormData();
          fd.append('file', pdfFile);
          fd.append('name', pdfFile.name);
          fd.append('documentCategory', 'quotation');
          fd.append('quotationId', quotationId);
          if (form.dealId) fd.append('dealId', form.dealId);
          await documentsAPI.upload(fd);
        } catch (e) { console.error('PDF upload failed:', e); }
      }

      onCreated();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  // Filter RFQs by selected deal
  const filteredRfqs = form.dealId ? rfqs.filter(r => r.deal_id === form.dealId) : rfqs;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-amber-50 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Create Quotation</h2>
            <p className="text-sm text-amber-700 mt-0.5">Professional logistics price quote</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* Link to Deal/Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Customer *</label>
              <select value={form.customerId} onChange={e => f('customerId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400">
                <option value="">— Select Customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Link to Deal</label>
              <select value={form.dealId} onChange={e => f('dealId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400">
                <option value="">— None —</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.deal_number} – {d.title}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Link to RFQ</label>
              <select value={form.rfqId} onChange={e => f('rfqId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">— None —</option>
                {filteredRfqs.map(r => <option key={r.id} value={r.id}>{r.rfq_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
              <select value={form.currency} onChange={e => f('currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {['USD','EUR','GBP','AED','SAR','EGP'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Price Breakdown */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Calculator className="w-4 h-4 text-amber-500" /> Price Breakdown
            </h3>
            <div className="bg-amber-50 rounded-xl p-4 space-y-2 border border-amber-100">
              {[
                { field: 'originCharges', label: 'Origin / Export Charges' },
                { field: 'freightCost', label: 'Freight Cost (Main Haul)' },
                { field: 'destinationCharges', label: 'Destination / Import Charges' },
                { field: 'customsClearance', label: 'Customs Clearance' },
                { field: 'insurance', label: 'Insurance' },
                { field: 'otherCharges', label: 'Other Charges / Surcharges' },
              ].map(row => (
                <div key={row.field} className="flex items-center gap-3">
                  <label className="text-sm text-gray-600 w-52">{row.label}</label>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-xs text-gray-400">{form.currency}</span>
                    <input type="number" min="0" step="0.01"
                      value={(form as any)[row.field]}
                      onChange={e => f(row.field, parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-1.5 border border-amber-200 bg-white rounded-lg text-sm focus:ring-2 focus:ring-amber-400 text-right" />
                  </div>
                </div>
              ))}
              <div className="border-t border-amber-200 pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-bold">{form.currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Tax Rate:</span>
                  <input type="number" min="0" max="100" step="0.1" value={form.taxRate}
                    onChange={e => f('taxRate', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-amber-200 bg-white rounded text-sm text-right" />
                  <span className="text-sm text-gray-400">%  = {form.currency} {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-amber-300 pt-2">
                  <span className="text-gray-800">TOTAL:</span>
                  <span className="text-amber-700 text-lg">{form.currency} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items (optional) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-700">Line Items (Optional)</h3>
              <button onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>
            {items.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-1 text-xs font-medium text-gray-500 px-1">
                  <span className="col-span-2">Category</span>
                  <span className="col-span-4">Description</span>
                  <span className="col-span-1">Qty</span>
                  <span className="col-span-2">Unit Price</span>
                  <span className="col-span-2">Amount</span>
                  <span className="col-span-1"></span>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 items-center">
                    <select value={item.category} onChange={e => updateItem(i, 'category', e.target.value)}
                      className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs">
                      {['freight','origin','destination','customs','insurance','other'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="text" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                      placeholder="Description" className="col-span-4 px-2 py-1.5 border border-gray-300 rounded text-xs" />
                    <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value)||1)}
                      className="col-span-1 px-2 py-1.5 border border-gray-300 rounded text-xs text-right" />
                    <input type="number" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', parseFloat(e.target.value)||0)}
                      className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-xs text-right" />
                    <span className="col-span-2 px-2 py-1.5 bg-gray-50 rounded text-xs text-right font-medium">
                      {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => removeItem(i)} className="col-span-1 p-1 text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Terms */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Valid Until</label>
              <input type="date" value={form.validUntil} onChange={e => f('validUntil', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Transit Time (days)</label>
              <input type="number" value={form.transitTimeDays} onChange={e => f('transitTimeDays', e.target.value)}
                placeholder="e.g. 21" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Terms</label>
            <input type="text" value={form.paymentTerms} onChange={e => f('paymentTerms', e.target.value)}
              placeholder="e.g. 30 days net, 50% advance..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => f('notes', e.target.value)}
              placeholder="Additional notes for the client..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Terms & Conditions</label>
            <textarea rows={2} value={form.termsConditions} onChange={e => f('termsConditions', e.target.value)}
              placeholder="Standard T&C or specific conditions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Attach PDF Quotation (optional)
            </label>
            <div
              onClick={() => document.getElementById('quote-pdf')?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${pdfFile ? 'border-amber-400 bg-amber-50' : 'border-gray-300 hover:border-amber-300 hover:bg-amber-50/30'}`}
            >
              <Upload className="w-6 h-6 mx-auto text-gray-400 mb-1" />
              <p className="text-sm text-gray-600">
                {pdfFile ? <span className="font-semibold text-amber-700">{pdfFile.name}</span> : 'Upload PDF quote document'}
              </p>
              <input id="quote-pdf" type="file" accept=".pdf" className="hidden"
                onChange={e => setPdfFile(e.target.files?.[0] || null)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleCreate} disabled={saving || !form.customerId}
            className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
            {saving ? 'Creating...' : 'Create Quotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuotationsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillDealId = searchParams.get('dealId') || undefined;
  const canCreate = ['Admin', 'Finance', 'Operations'].includes(user?.role || '');

  const [quotations, setQuotations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(!!prefillDealId);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, cRes, dRes, rRes] = await Promise.all([
        quotationsAPI.getAll({ limit: 200, status: filterStatus || undefined }),
        customersAPI.getAll({ limit: 200 }),
        dealsAPI.getAll({ limit: 200 }),
        rfqsAPI.getAll({ limit: 200 }),
      ]);
      setQuotations(qRes.data?.data || []);
      setCustomers(cRes.data?.data || []);
      setDeals(dRes.data?.data || []);
      setRfqs(rRes.data?.data || []);
    } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await quotationsAPI.update(id, { status });
      await fetchData();
      showToast('Status updated');
    } catch { showToast('Failed', 'error'); }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
            <p className="text-sm text-gray-500 mt-0.5">Price quotations for logistics services</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 shadow-sm">
              <Plus className="w-4 h-4" /> New Quotation
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${!filterStatus ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-600 hover:border-amber-200'}`}>
            All ({quotations.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <button key={k} onClick={() => setFilterStatus(filterStatus === k ? '' : k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${filterStatus === k ? `border-amber-400 bg-amber-50 text-amber-700` : `bg-white border-gray-200 text-gray-600 hover:border-amber-200`}`}>
              {v.label} ({quotations.filter(q => q.status === k).length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 text-amber-500 animate-spin" /></div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No quotations yet</p>
            {canCreate && <button onClick={() => setShowCreateModal(true)} className="mt-3 text-sm text-amber-600 hover:underline">Create first quotation →</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {quotations.map(q => {
              const statusCfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
              return (
                <div key={q.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-amber-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-bold font-mono text-gray-500">{q.quotation_number}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                        {q.rfq_number && <span className="text-xs text-gray-400">RFQ: {q.rfq_number}</span>}
                        {q.deal_number && <span className="text-xs text-gray-400">Deal: {q.deal_number}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700 font-medium mb-3">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {q.customer_name}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                          <div className="text-xs text-gray-500 mb-0.5">Freight</div>
                          <div className="text-sm font-bold text-gray-800">{q.currency} {Number(q.freight_cost||0).toLocaleString()}</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                          <div className="text-xs text-gray-500 mb-0.5">Subtotal</div>
                          <div className="text-sm font-bold text-gray-800">{q.currency} {Number(q.subtotal||0).toLocaleString()}</div>
                        </div>
                        <div className="bg-amber-100 rounded-lg p-2.5 text-center border border-amber-200">
                          <div className="text-xs text-amber-700 mb-0.5">TOTAL</div>
                          <div className="text-base font-bold text-amber-800">{q.currency} {Number(q.total_amount||0).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2.5">
                          <div className="text-xs text-gray-500 mb-0.5">Valid Until</div>
                          <div className="text-sm font-medium text-gray-700">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</div>
                          {q.transit_time_days && <div className="text-xs text-gray-400 mt-0.5">{q.transit_time_days} days transit</div>}
                        </div>
                      </div>
                      {q.payment_terms && (
                        <p className="mt-2 text-xs text-gray-500">Payment: {q.payment_terms}</p>
                      )}
                      {q.notes && <p className="mt-1 text-xs text-gray-400 line-clamp-2">{q.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-2 items-end min-w-fit">
                      <div className="text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString()}</div>
                      {canCreate && (
                        <select value={q.status} onChange={e => handleStatusUpdate(q.id, e.target.value)}
                          className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-400">
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      )}
                      {q.deal_id && (
                        <button onClick={() => router.push(`/deals/${q.deal_id}`)}
                          className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                          View Deal <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showCreateModal && (
          <QuotationFormModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { setShowCreateModal(false); fetchData(); showToast('Quotation created!'); }}
            prefillDealId={prefillDealId}
            customers={customers}
            deals={deals}
            rfqs={rfqs}
          />
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

export default function QuotationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><RefreshCw className="w-8 h-8 text-amber-500 animate-spin" /></div>}>
      <QuotationsContent />
    </Suspense>
  );
}
