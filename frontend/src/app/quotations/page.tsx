'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/lib/i18n';
import { quotationsAPI, customersAPI, dealsAPI, rfqsAPI, documentsAPI } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, RefreshCw, X, CheckCircle2, AlertCircle, DollarSign, Upload,
  FileText, Building2, Trash2, ExternalLink, Calculator, Calendar,
  Tag, Edit3, Globe, Ship, Package, Printer, Download, ArrowRight,
  ChevronDown, ChevronUp, Plane, Truck, Star, Hash
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; labelAr: string }> = {
  draft:    { label: 'Draft',    labelAr: 'مسودة',     color: 'bg-gray-100 text-gray-600 border-gray-200' },
  sent:     { label: 'Sent',     labelAr: 'أُرسل',     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  accepted: { label: 'Accepted', labelAr: 'مقبول',     color: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', labelAr: 'مرفوض',     color: 'bg-red-100 text-red-700 border-red-200' },
  expired:  { label: 'Expired',  labelAr: 'منتهي',     color: 'bg-orange-100 text-orange-700 border-orange-200' },
  revised:  { label: 'Revised',  labelAr: 'معدّل',     color: 'bg-violet-100 text-violet-700 border-violet-200' },
};

const CHARGE_CATEGORIES = [
  { key: 'origin',      label: 'Origin/Export Charges',     labelAr: 'رسوم المنشأ/التصدير' },
  { key: 'freight',     label: 'Freight Cost',               labelAr: 'تكلفة الشحن' },
  { key: 'destination', label: 'Destination/Import Charges', labelAr: 'رسوم الوجهة/الاستيراد' },
  { key: 'customs',     label: 'Customs Clearance',          labelAr: 'التخليص الجمركي' },
  { key: 'insurance',   label: 'Insurance',                  labelAr: 'التأمين' },
  { key: 'other',       label: 'Other Charges',              labelAr: 'رسوم أخرى' },
];

const CURRENCIES = ['USD','EUR','GBP','AED','SAR','EGP','CNY','JPY'];

interface QuotationItem {
  category: string; description: string;
  quantity: number; unit: string; unitPrice: number; amount: number;
}

// ─── PDF Preview Component ────────────────────────────────────────────────────
function QuotationPDFPreview({ quotation, onClose }: { quotation: any; onClose: () => void }) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b no-print">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Printer className="w-5 h-5" /> Quotation {quotation.quotation_number}
          </h2>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" id="pdf-content">
          {/* PDF Layout */}
          <div className="p-8 max-w-3xl mx-auto space-y-6 text-sm print:p-4">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-violet-600 pb-5">
              <div>
                <div className="text-2xl font-bold text-violet-700">QUOTATION</div>
                <div className="text-xs text-gray-500 mt-1">
                  {quotation.rfq_number ? `Ref: ${quotation.rfq_number}` : ''}
                  {quotation.deal_number ? ` · Deal: ${quotation.deal_number}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-gray-800">{quotation.quotation_number}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Date: {quotation.quotation_date ? new Date(quotation.quotation_date).toLocaleDateString() : new Date(quotation.created_at).toLocaleDateString()}
                </div>
                {quotation.valid_until && (
                  <div className="text-xs text-gray-500">Valid Until: {new Date(quotation.valid_until).toLocaleDateString()}</div>
                )}
              </div>
            </div>

            {/* Customer */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Bill To</div>
                <div className="font-bold text-gray-900">{quotation.customer_name}</div>
                {quotation.client_contact_name && <div className="text-gray-600">{quotation.client_contact_name}</div>}
                {quotation.customer_address && <div className="text-gray-500 text-xs mt-1">{quotation.customer_address}</div>}
                {quotation.client_contact_email && <div className="text-gray-500 text-xs">{quotation.client_contact_email}</div>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Shipment Information</div>
                <div className="space-y-1 text-xs text-gray-600">
                  {(quotation.shipment_origin_country || quotation.rfq_origin_country) && (
                    <div><span className="font-medium">Origin: </span>{quotation.shipment_origin_country || quotation.rfq_origin_country}{(quotation.shipment_origin_port || quotation.rfq_origin_port) && ` (${quotation.shipment_origin_port || quotation.rfq_origin_port})`}</div>
                  )}
                  {(quotation.shipment_destination_country || quotation.rfq_destination_country) && (
                    <div><span className="font-medium">Destination: </span>{quotation.shipment_destination_country || quotation.rfq_destination_country}{(quotation.shipment_destination_port || quotation.rfq_destination_port) && ` (${quotation.shipment_destination_port || quotation.rfq_destination_port})`}</div>
                  )}
                  {quotation.shipment_mode && <div><span className="font-medium">Mode: </span><span className="capitalize">{quotation.shipment_mode}</span></div>}
                  {quotation.carrier && <div><span className="font-medium">Carrier: </span>{quotation.carrier}</div>}
                  {quotation.transit_time_days && <div><span className="font-medium">Transit: </span>{quotation.transit_time_days} days</div>}
                  {quotation.shipment_incoterms && <div><span className="font-medium">Incoterms: </span>{quotation.shipment_incoterms}</div>}
                  {quotation.shipment_cargo_description && <div><span className="font-medium">Cargo: </span>{quotation.shipment_cargo_description}</div>}
                </div>
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pricing Breakdown</div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-violet-50 text-xs font-semibold text-gray-600 border-b border-gray-200">
                    <th className="text-left p-3">Description</th>
                    <th className="text-right p-3 w-24">Qty</th>
                    <th className="text-right p-3 w-28">Unit Price</th>
                    <th className="text-right p-3 w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items && quotation.items.length > 0 ? (
                    quotation.items.map((item: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          <span className="text-xs text-gray-400 block">{CHARGE_CATEGORIES.find(c => c.key === item.category)?.label || item.category}</span>
                          <span className="text-gray-800">{item.description}</span>
                        </td>
                        <td className="p-3 text-right text-gray-600">{item.quantity} {item.unit}</td>
                        <td className="p-3 text-right text-gray-600">{quotation.currency} {fmt(item.unit_price)}</td>
                        <td className="p-3 text-right font-medium text-gray-800">{quotation.currency} {fmt(item.amount)}</td>
                      </tr>
                    ))
                  ) : (
                    // Summary rows from charges
                    CHARGE_CATEGORIES.map(cat => {
                      const val = quotation[cat.key === 'freight' ? 'freight_cost' : cat.key === 'destination' ? 'destination_charges' : cat.key === 'origin' ? 'origin_charges' : cat.key + '_clearance' in quotation ? quotation[cat.key + '_clearance'] : quotation[cat.key]] || 0;
                      if (!val) return null;
                      return (
                        <tr key={cat.key} className="border-b border-gray-100">
                          <td className="p-3 text-gray-700">{cat.label}</td>
                          <td className="p-3 text-right text-gray-500">1 shipment</td>
                          <td className="p-3 text-right text-gray-600">{quotation.currency} {fmt(Number(val))}</td>
                          <td className="p-3 text-right font-medium text-gray-800">{quotation.currency} {fmt(Number(val))}</td>
                        </tr>
                      );
                    }).filter(Boolean)
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mt-3">
                <div className="w-64 space-y-1.5">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal:</span>
                    <span className="font-medium">{quotation.currency} {fmt(Number(quotation.subtotal))}</span>
                  </div>
                  {Number(quotation.tax_rate) > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Tax ({quotation.tax_rate}%):</span>
                      <span>{quotation.currency} {fmt(Number(quotation.tax_amount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-300 pt-2">
                    <span>TOTAL:</span>
                    <span className="text-violet-700">{quotation.currency} {fmt(Number(quotation.total_amount))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            {(quotation.payment_terms || quotation.preferred_route_notes || quotation.terms_conditions) && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs text-gray-600">
                {quotation.payment_terms && <div><span className="font-bold text-gray-700">Payment Terms: </span>{quotation.payment_terms}</div>}
                {quotation.preferred_route_notes && <div><span className="font-bold text-gray-700">Route Notes: </span>{quotation.preferred_route_notes}</div>}
                {quotation.terms_conditions && <div className="mt-2"><span className="font-bold text-gray-700 block mb-1">Terms & Conditions:</span><p className="whitespace-pre-wrap">{quotation.terms_conditions}</p></div>}
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
              <p>This quotation is valid until {quotation.valid_until ? new Date(quotation.valid_until).toLocaleDateString() : 'further notice'}</p>
              <p className="mt-1">Generated: {new Date().toLocaleDateString()} · {quotation.created_by_name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quotation Form Modal ─────────────────────────────────────────────────────
function QuotationFormModal({ onClose, onCreated, prefillDealId, prefillRFQId, customers, deals, rfqs, editData }: {
  onClose: () => void; onCreated: () => void;
  prefillDealId?: string; prefillRFQId?: string;
  customers: any[]; deals: any[]; rfqs: any[];
  editData?: any;
}) {
  const { user } = useAuth();
  const { isRTL } = useI18n();
  const today = new Date().toISOString().split('T')[0];
  const defaultValid = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    customerId: editData?.customer_id || '',
    dealId: prefillDealId || editData?.deal_id || '',
    rfqId: prefillRFQId || editData?.rfq_id || '',
    // Dates
    quotationDate: editData?.quotation_date?.split('T')[0] || today,
    validUntil: editData?.valid_until?.split('T')[0] || defaultValid,
    currency: editData?.currency || 'USD',
    // Pricing
    originCharges: Number(editData?.origin_charges || 0),
    freightCost: Number(editData?.freight_cost || 0),
    destinationCharges: Number(editData?.destination_charges || 0),
    customsClearance: Number(editData?.customs_clearance || 0),
    insurance: Number(editData?.insurance || 0),
    otherCharges: Number(editData?.other_charges || 0),
    taxRate: Number(editData?.tax_rate || 0),
    // Operational
    carrier: editData?.carrier || '',
    transitTimeDays: editData?.transit_time_days?.toString() || '',
    preferredRouteNotes: editData?.preferred_route_notes || '',
    paymentTerms: editData?.payment_terms || '',
    notes: editData?.notes || '',
    termsConditions: editData?.terms_conditions || '',
    // Shipment info
    shipmentOriginCountry: editData?.shipment_origin_country || '',
    shipmentOriginPort: editData?.shipment_origin_port || '',
    shipmentDestinationCountry: editData?.shipment_destination_country || '',
    shipmentDestinationPort: editData?.shipment_destination_port || '',
    shipmentMode: editData?.shipment_mode || '',
    shipmentServiceType: editData?.shipment_service_type || '',
    shipmentIncoterms: editData?.shipment_incoterms || '',
    shipmentCargoDescription: editData?.shipment_cargo_description || '',
    shipmentWeightKg: editData?.shipment_weight_kg?.toString() || '',
    shipmentVolumeCbm: editData?.shipment_volume_cbm?.toString() || '',
    // Client
    clientContactName: editData?.client_contact_name || '',
    clientContactEmail: editData?.client_contact_email || '',
    clientContactPhone: editData?.client_contact_phone || '',
  });

  const [items, setItems] = useState<QuotationItem[]>(
    editData?.items?.map((it: any) => ({
      category: it.category, description: it.description,
      quantity: Number(it.quantity), unit: it.unit || 'shipment',
      unitPrice: Number(it.unit_price), amount: Number(it.amount)
    })) || []
  );
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'pricing' | 'shipment' | 'operational'>('pricing');

  const f = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  // Auto-fill from RFQ when rfqId changes
  useEffect(() => {
    if (form.rfqId) {
      const rfq = rfqs.find(r => r.id === form.rfqId);
      if (rfq) {
        setForm(p => ({
          ...p,
          customerId: rfq.customer_id || p.customerId,
          dealId: rfq.deal_id || p.dealId,
          shipmentOriginCountry: rfq.origin_country || p.shipmentOriginCountry,
          shipmentOriginPort: rfq.origin_port || p.shipmentOriginPort,
          shipmentDestinationCountry: rfq.destination_country || p.shipmentDestinationCountry,
          shipmentDestinationPort: rfq.destination_port || p.shipmentDestinationPort,
          shipmentMode: rfq.shipping_mode || p.shipmentMode,
          shipmentServiceType: rfq.service_type || p.shipmentServiceType,
          shipmentIncoterms: rfq.incoterms || p.shipmentIncoterms,
          shipmentCargoDescription: rfq.cargo_description || p.shipmentCargoDescription,
          shipmentWeightKg: rfq.weight_kg?.toString() || p.shipmentWeightKg,
          shipmentVolumeCbm: rfq.volume_cbm?.toString() || p.shipmentVolumeCbm,
        }));
      }
    }
  }, [form.rfqId]);

  const subtotal = form.originCharges + form.freightCost + form.destinationCharges +
    form.customsClearance + form.insurance + form.otherCharges;
  const taxAmount = subtotal * (form.taxRate / 100);
  const totalAmount = subtotal + taxAmount;
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const addItem = () => setItems(p => [...p, { category: 'freight', description: '', quantity: 1, unit: 'shipment', unitPrice: 0, amount: 0 }]);
  const updateItem = (i: number, field: string, value: any) => {
    setItems(p => p.map((item, idx) => {
      if (idx !== i) return item;
      const u = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        u.amount = Number(u.quantity) * Number(u.unitPrice);
      }
      return u;
    }));
  };
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!form.customerId) return;
    setSaving(true);
    try {
      let res;
      const payload = {
        ...form,
        transitTimeDays: form.transitTimeDays ? parseInt(form.transitTimeDays) : undefined,
        rfqId: form.rfqId || undefined,
        dealId: form.dealId || undefined,
        items: items.length > 0 ? items : undefined,
      };
      if (editData) {
        res = await quotationsAPI.update(editData.id, payload);
      } else {
        res = await quotationsAPI.create(payload);
      }
      const quotationId = res.data?.data?.id || editData?.id;
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

  const filteredRfqs = form.dealId ? rfqs.filter(r => r.deal_id === form.dealId) : rfqs;

  const numInput = (field: string, label: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{form.currency}</span>
        <input type="number" min="0" step="0.01"
          value={(form as any)[field]}
          onChange={e => f(field, parseFloat(e.target.value) || 0)}
          className="w-full border border-gray-300 rounded-xl ps-10 pe-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 ltr-num" />
      </div>
    </div>
  );

  const TABS = [
    { key: 'pricing', label: isRTL ? 'التسعير' : 'Pricing' },
    { key: 'shipment', label: isRTL ? 'معلومات الشحن' : 'Shipment Info' },
    { key: 'operational', label: isRTL ? 'التفاصيل التشغيلية' : 'Operational' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-violet-600" />
              {editData ? (isRTL ? 'تعديل عرض السعر' : 'Edit Quotation') : (isRTL ? 'إنشاء عرض سعر' : 'Create Quotation')}
            </h2>
            {editData && <p className="text-xs text-gray-500 mt-0.5">{editData.quotation_number}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Deal/Customer/RFQ Selectors */}
        <div className="px-5 pt-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {isRTL ? 'العميل' : 'Customer'} <span className="text-red-500">*</span>
            </label>
            <select value={form.customerId} onChange={e => f('customerId', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400">
              <option value="">Select...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'الصفقة' : 'Deal'}</label>
            <select value={form.dealId} onChange={e => f('dealId', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400">
              <option value="">— Optional —</option>
              {deals.map(d => <option key={d.id} value={d.id}>{d.deal_number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              {isRTL ? 'طلب عرض السعر' : 'RFQ'}
              {form.rfqId && <span className="ms-1 text-xs text-green-600">✓ Auto-filled</span>}
            </label>
            <select value={form.rfqId} onChange={e => f('rfqId', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400">
              <option value="">— Optional —</option>
              {filteredRfqs.map(r => <option key={r.id} value={r.id}>{r.rfq_number}</option>)}
            </select>
          </div>
        </div>

        {/* Quotation metadata */}
        <div className="px-5 pt-3 grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'تاريخ العرض' : 'Date'}</label>
            <input type="date" value={form.quotationDate} onChange={e => f('quotationDate', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'صالح حتى' : 'Valid Until'}</label>
            <input type="date" value={form.validUntil} onChange={e => f('validUntil', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'العملة' : 'Currency'}</label>
            <select value={form.currency} onChange={e => f('currency', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Tax %</label>
            <input type="number" min="0" max="100" step="0.5" value={form.taxRate} onChange={e => f('taxRate', parseFloat(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 ltr-num" />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === tab.key ? 'bg-white shadow-sm text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Pricing Tab ── */}
          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {numInput('originCharges', isRTL ? 'رسوم المنشأ/التصدير' : 'Origin / Export Charges')}
                {numInput('freightCost', isRTL ? 'تكلفة الشحن' : 'Freight Cost')}
                {numInput('destinationCharges', isRTL ? 'رسوم الوجهة/الاستيراد' : 'Destination / Import Charges')}
                {numInput('customsClearance', isRTL ? 'التخليص الجمركي' : 'Customs Clearance')}
                {numInput('insurance', isRTL ? 'التأمين' : 'Insurance')}
                {numInput('otherCharges', isRTL ? 'رسوم أخرى' : 'Other Charges')}
              </div>

              {/* Totals Summary */}
              <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>{isRTL ? 'المجموع الفرعي' : 'Subtotal'}</span>
                    <span className="font-medium ltr-num">{form.currency} {fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>{isRTL ? 'الضريبة' : 'Tax'} ({form.taxRate}%)</span>
                    <span className="ltr-num">{form.currency} {fmt(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-violet-700 text-base border-t border-violet-300 pt-2">
                    <span>{isRTL ? 'الإجمالي' : 'TOTAL'}</span>
                    <span className="ltr-num">{form.currency} {fmt(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-700">{isRTL ? 'بنود التسعير التفصيلي' : 'Detailed Line Items'}</label>
                  <button onClick={addItem} className="text-xs text-violet-600 hover:bg-violet-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 border border-violet-200">
                    <Plus className="w-3.5 h-3.5" /> {isRTL ? 'إضافة بند' : 'Add Item'}
                  </button>
                </div>
                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-2">
                        <div className="col-span-2">
                          <select value={item.category} onChange={e => updateItem(i, 'category', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-violet-400">
                            {CHARGE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </div>
                        <div className="col-span-4">
                          <input type="text" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                            placeholder="Description..." className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-violet-400" />
                        </div>
                        <div className="col-span-2">
                          <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                            placeholder="Price" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-violet-400 ltr-num" />
                        </div>
                        <div className="col-span-1">
                          <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 1)}
                            placeholder="Qty" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-violet-400 ltr-num" />
                        </div>
                        <div className="col-span-2 text-right text-xs font-semibold text-gray-700 ltr-num">
                          {form.currency} {fmt(item.amount)}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Shipment Info Tab ── */}
          {activeTab === 'shipment' && (
            <div className="space-y-4">
              {form.rfqId && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  {isRTL ? 'تم ملء البيانات تلقائياً من طلب عرض السعر المرتبط' : 'Shipment info auto-filled from linked RFQ. You may override any field.'}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'بلد المنشأ' : 'Origin Country'}</label>
                  <input type="text" value={form.shipmentOriginCountry} onChange={e => f('shipmentOriginCountry', e.target.value)}
                    placeholder="e.g. China" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'ميناء المنشأ' : 'Origin Port'}</label>
                  <input type="text" value={form.shipmentOriginPort} onChange={e => f('shipmentOriginPort', e.target.value)}
                    placeholder="e.g. Shanghai (SHA)" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'بلد الوجهة' : 'Destination Country'}</label>
                  <input type="text" value={form.shipmentDestinationCountry} onChange={e => f('shipmentDestinationCountry', e.target.value)}
                    placeholder="e.g. Saudi Arabia" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'ميناء الوجهة' : 'Destination Port'}</label>
                  <input type="text" value={form.shipmentDestinationPort} onChange={e => f('shipmentDestinationPort', e.target.value)}
                    placeholder="e.g. Jeddah (JED)" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'وسيلة الشحن' : 'Shipping Mode'}</label>
                  <select value={form.shipmentMode} onChange={e => f('shipmentMode', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="">Select...</option>
                    {['sea','air','road','rail','multimodal'].map(m => <option key={m} value={m} className="capitalize">{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Incoterms</label>
                  <select value={form.shipmentIncoterms} onChange={e => f('shipmentIncoterms', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="">Select...</option>
                    {['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'].map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الوزن (كجم)' : 'Weight (kg)'}</label>
                  <input type="number" value={form.shipmentWeightKg} onChange={e => f('shipmentWeightKg', e.target.value)}
                    placeholder="0.00" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 ltr-num" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الحجم (م³)' : 'Volume (CBM)'}</label>
                  <input type="number" value={form.shipmentVolumeCbm} onChange={e => f('shipmentVolumeCbm', e.target.value)}
                    placeholder="0.00" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 ltr-num" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'وصف البضاعة' : 'Cargo Description'}</label>
                <textarea value={form.shipmentCargoDescription} onChange={e => f('shipmentCargoDescription', e.target.value)}
                  placeholder="Cargo details..." rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>
              {/* Client contact */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-xs font-bold text-gray-700 mb-3">{isRTL ? 'جهة الاتصال' : 'Client Contact Info (for PDF)'}</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{isRTL ? 'الاسم' : 'Name'}</label>
                    <input type="text" value={form.clientContactName} onChange={e => f('clientContactName', e.target.value)}
                      placeholder="Contact name" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                    <input type="email" value={form.clientContactEmail} onChange={e => f('clientContactEmail', e.target.value)}
                      placeholder="email@company.com" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{isRTL ? 'الهاتف' : 'Phone'}</label>
                    <input type="tel" value={form.clientContactPhone} onChange={e => f('clientContactPhone', e.target.value)}
                      placeholder="+971..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Operational Tab ── */}
          {activeTab === 'operational' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الناقل/شركة الطيران' : 'Carrier / Airline'}</label>
                  <input type="text" value={form.carrier} onChange={e => f('carrier', e.target.value)}
                    placeholder="e.g. Maersk, Emirates SkyCargo..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'وقت العبور (أيام)' : 'Transit Time (days)'}</label>
                  <input type="number" min="1" value={form.transitTimeDays} onChange={e => f('transitTimeDays', e.target.value)}
                    placeholder="e.g. 21" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 ltr-num" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'ملاحظات المسار المفضل' : 'Preferred Route Notes'}</label>
                <textarea value={form.preferredRouteNotes} onChange={e => f('preferredRouteNotes', e.target.value)}
                  placeholder="Routing details, preferred vessels, transshipment ports..." rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'شروط الدفع' : 'Payment Terms'}</label>
                <input type="text" value={form.paymentTerms} onChange={e => f('paymentTerms', e.target.value)}
                  placeholder="e.g. 30 days net, prepayment..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الشروط والأحكام' : 'Terms & Conditions'}</label>
                <textarea value={form.termsConditions} onChange={e => f('termsConditions', e.target.value)}
                  placeholder="Standard terms..." rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'ملاحظات داخلية' : 'Internal Notes'}</label>
                <textarea value={form.notes} onChange={e => f('notes', e.target.value)}
                  placeholder="Internal notes..." rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>
              {/* Attach PDF */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  <Upload className="w-3.5 h-3.5 inline me-1" />{isRTL ? 'رفع ملف PDF' : 'Attach PDF (optional)'}
                </label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={e => setPdfFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:me-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100" />
                {pdfFile && <p className="text-xs text-green-600 mt-1">✓ {pdfFile.name}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-xl">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSave} disabled={saving || !form.customerId}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-60 transition-colors">
            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
            {editData ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'إنشاء عرض السعر' : 'Create Quotation')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function QuotationsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isRTL } = useI18n();
  const prefillDealId = searchParams.get('dealId') || '';
  const prefillRFQId = searchParams.get('rfqId') || '';

  const canCreate = ['Admin', 'Finance', 'Operations', 'Sales'].includes(user?.role || '');
  const canDelete = ['Admin', 'Finance', 'Operations'].includes(user?.role || '');

  const [quotations, setQuotations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!(prefillDealId || prefillRFQId));
  const [editData, setEditData] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [pdfPreview, setPdfPreview] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    try {
      await quotationsAPI.delete(id);
      setDeletingId(null);
      fetchData();
      showToast(isRTL ? 'تم حذف عرض السعر' : 'Quotation deleted');
    } catch { showToast('Failed', 'error'); }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await quotationsAPI.update(id, { status });
      fetchData();
      showToast(isRTL ? 'تم تحديث الحالة' : 'Status updated');
    } catch { showToast('Failed', 'error'); }
  };

  const openPDFPreview = async (quotation: any) => {
    try {
      const res = await quotationsAPI.getOne(quotation.id);
      setPdfPreview(res.data?.data || quotation);
    } catch {
      setPdfPreview(quotation);
    }
  };

  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isRTL ? 'عروض الأسعار' : 'Quotations'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{isRTL ? 'إدارة عروض الأسعار ووثائق التسعير' : 'Manage pricing quotations and proposals'}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            {canCreate && (
              <button onClick={() => { setEditData(null); setShowForm(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 shadow-sm">
                <Plus className="w-4 h-4" /> {isRTL ? 'إنشاء عرض' : 'New Quotation'}
              </button>
            )}
          </div>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${!filterStatus ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
            {isRTL ? 'الكل' : 'All'} ({quotations.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = quotations.filter(q => q.status === key).length;
            if (count === 0) return null;
            return (
              <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${filterStatus === key ? 'border-violet-400 bg-violet-50 text-violet-700' : 'bg-white border-gray-200 hover:border-violet-200 text-gray-600'}`}>
                {isRTL ? cfg.labelAr : cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 text-violet-500 animate-spin" /></div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{isRTL ? 'لا توجد عروض أسعار' : 'No quotations yet'}</p>
            {canCreate && (
              <button onClick={() => { setEditData(null); setShowForm(true); }}
                className="mt-3 text-sm text-violet-600 hover:underline">
                {isRTL ? 'إنشاء أول عرض سعر ←' : 'Create your first quotation →'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {quotations.map(q => {
              const statusCfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
              return (
                <div key={q.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-violet-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-bold font-mono text-gray-600 text-sm">{q.quotation_number}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${statusCfg.color}`}>
                          {isRTL ? statusCfg.labelAr : statusCfg.label}
                        </span>
                        {q.rfq_number && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            RFQ: {q.rfq_number}
                          </span>
                        )}
                        {q.deal_number && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            Deal: {q.deal_number}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        {q.customer_name}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-green-500" />
                          <span className="font-bold text-gray-800 ltr-num">{q.currency} {fmt(Number(q.total_amount))}</span>
                        </span>
                        {q.valid_until && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {isRTL ? 'صالح حتى:' : 'Valid:'} {new Date(q.valid_until).toLocaleDateString()}
                          </span>
                        )}
                        {q.carrier && (
                          <span className="flex items-center gap-1">
                            <Ship className="w-3.5 h-3.5" /> {q.carrier}
                          </span>
                        )}
                        {q.transit_time_days && (
                          <span>{isRTL ? 'العبور:' : 'Transit:'} {q.transit_time_days}d</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end flex-shrink-0">
                      <span className="text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString()}</span>
                      {canCreate && (
                        <select value={q.status} onChange={e => handleStatusUpdate(q.id, e.target.value)}
                          className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-violet-400">
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      )}
                      <div className="flex gap-1">
                        <button onClick={() => openPDFPreview(q)}
                          className="text-xs text-gray-500 hover:bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                          title="Preview PDF">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {canCreate && (
                          <button onClick={() => { setEditData(q); setShowForm(true); }}
                            className="text-xs text-violet-600 hover:bg-violet-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {q.deal_id && (
                          <button onClick={() => router.push(`/deals/${q.deal_id}`)}
                            className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeletingId(q.id)}
                            className="text-xs text-red-400 hover:bg-red-50 hover:text-red-600 px-2 py-1 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete confirm */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm mx-4 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{isRTL ? 'حذف عرض السعر؟' : 'Delete Quotation?'}</h3>
              <p className="text-sm text-gray-500 mb-5">{isRTL ? 'هذا الإجراء لا يمكن التراجع عنه.' : 'This action cannot be undone.'}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={() => handleDelete(deletingId)} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
                  {isRTL ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-4 end-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* PDF Preview */}
        {pdfPreview && <QuotationPDFPreview quotation={pdfPreview} onClose={() => setPdfPreview(null)} />}

        {/* Form Modal */}
        {showForm && (
          <QuotationFormModal
            onClose={() => { setShowForm(false); setEditData(null); }}
            onCreated={() => {
              setShowForm(false); setEditData(null); fetchData();
              showToast(isRTL ? 'تم حفظ عرض السعر بنجاح!' : 'Quotation saved successfully!');
            }}
            prefillDealId={prefillDealId || undefined}
            prefillRFQId={prefillRFQId || undefined}
            customers={customers}
            deals={deals}
            rfqs={rfqs}
            editData={editData}
          />
        )}
      </div>
    </MainLayout>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><RefreshCw className="w-8 h-8 text-violet-500 animate-spin" /></div>}>
      <QuotationsContent />
    </Suspense>
  );
}
