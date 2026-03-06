'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/lib/i18n';
import { dealsAPI, customersAPI, rfqsAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Filter, X, ChevronDown, ChevronUp, RefreshCw,
  DollarSign, Calendar, Building2, User, ArrowRight, MoreHorizontal,
  TrendingUp, Target, CheckCircle2, XCircle, Edit3, Trash2,
  BarChart2, FileText, AlertCircle, Eye, Move, Layers, List,
  ChevronRight, Briefcase, Globe, Package, Ship, Plane
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Deal {
  id: string; deal_number: string; title: string; stage: string;
  value: number; currency: string; probability: number;
  customer_name?: string; customer_id?: string;
  assigned_to_name?: string; assigned_to?: string; created_by?: string;
  expected_close_date?: string; service_type?: string; shipping_mode?: string;
  origin_country?: string; destination_country?: string;
  rfq_count?: number; quotation_count?: number; task_count?: number;
  created_at: string; updated_at: string;
}

// ─── Stage Config ─────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'lead',        label: 'Lead',        labelAr: 'عميل محتمل', color: 'bg-slate-50 border-slate-200',   header: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-400',  accent: '#64748b' },
  { key: 'contacted',   label: 'Contacted',   labelAr: 'تم التواصل', color: 'bg-blue-50 border-blue-200',    header: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400',   accent: '#3b82f6' },
  { key: 'rfq',         label: 'RFQ',         labelAr: 'طلب عرض سعر',color: 'bg-violet-50 border-violet-200', header: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', accent: '#8b5cf6' },
  { key: 'quotation',   label: 'Quotation',   labelAr: 'عرض سعر',   color: 'bg-amber-50 border-amber-200',  header: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500',  accent: '#f59e0b' },
  { key: 'negotiation', label: 'Negotiation', labelAr: 'تفاوض',      color: 'bg-orange-50 border-orange-200', header: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', accent: '#f97316' },
  { key: 'won',         label: 'Won ✓',       labelAr: 'مكسب',      color: 'bg-green-50 border-green-200',  header: 'bg-green-100 text-green-700',  dot: 'bg-green-500',  accent: '#22c55e' },
  { key: 'lost',        label: 'Lost',        labelAr: 'خسارة',     color: 'bg-red-50 border-red-200',      header: 'bg-red-100 text-red-700',      dot: 'bg-red-400',    accent: '#ef4444' },
];

const CURRENCIES = ['USD','EUR','GBP','AED','SAR','EGP'];
const SHIPPING_MODES = [
  { value: 'sea', label: 'Sea Freight', icon: Ship },
  { value: 'air', label: 'Air Freight', icon: Plane },
  { value: 'road', label: 'Road Freight', icon: Package },
  { value: 'rail', label: 'Rail Freight', icon: Package },
  { value: 'multimodal', label: 'Multimodal', icon: Globe },
];

// ─── RFQ Submission Modal (from within deal) ────────────────────────────────
function RFQFormModal({ deal, onClose, onSubmit }: {
  deal: Deal; onClose: () => void; onSubmit: () => void;
}) {
  const [form, setForm] = useState({
    originCountry: deal.origin_country || '',
    originPort: '',
    originAddress: '',
    destinationCountry: deal.destination_country || '',
    destinationPort: '',
    destinationAddress: '',
    shippingMode: deal.shipping_mode || 'sea',
    serviceType: deal.service_type || '',
    incoterms: '',
    cargoType: '',
    cargoDescription: '',
    weightKg: '',
    volumeCbm: '',
    quantity: '',
    unitType: 'CBM',
    containerType: '',
    containerCount: '',
    hazardous: false,
    temperatureControlled: false,
    insuranceRequired: false,
    customsClearanceRequired: false,
    cargoReadyDate: '',
    requiredDeliveryDate: '',
    specialInstructions: '',
    notes: '',
    // Custom fields placeholder
    customField1: '',
    customField2: '',
    customField3: '',
  });
  const [saving, setSaving] = useState(false);

  const f = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await rfqsAPI.create({
        dealId: deal.id,
        customerId: deal.customer_id,
        originCountry: form.originCountry,
        originPort: form.originPort,
        originAddress: form.originAddress || undefined,
        destinationCountry: form.destinationCountry,
        destinationPort: form.destinationPort,
        destinationAddress: form.destinationAddress || undefined,
        shippingMode: form.shippingMode,
        serviceType: form.serviceType || undefined,
        incoterms: form.incoterms || undefined,
        cargoType: form.cargoType || undefined,
        cargoDescription: form.cargoDescription || undefined,
        weightKg: form.weightKg ? parseFloat(form.weightKg) : undefined,
        volumeCbm: form.volumeCbm ? parseFloat(form.volumeCbm) : undefined,
        quantity: form.quantity ? parseInt(form.quantity) : undefined,
        unitType: form.unitType || undefined,
        containerType: form.containerType || undefined,
        containerCount: form.containerCount ? parseInt(form.containerCount) : undefined,
        hazardous: form.hazardous,
        temperatureControlled: form.temperatureControlled,
        insuranceRequired: form.insuranceRequired,
        customsClearanceRequired: form.customsClearanceRequired,
        cargoReadyDate: form.cargoReadyDate || undefined,
        requiredDeliveryDate: form.requiredDeliveryDate || undefined,
        specialInstructions: form.specialInstructions || undefined,
        notes: form.notes || undefined,
        customFields: {
          customField1: form.customField1 || undefined,
          customField2: form.customField2 || undefined,
          customField3: form.customField3 || undefined,
        },
      });
      onSubmit();
    } catch (e) {
      console.error(e);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-violet-50 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Submit RFQ – Request for Quotation</h2>
            <p className="text-sm text-violet-600 mt-0.5">Deal: {deal.deal_number} · {deal.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/60"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Shipping Route */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-500" /> Shipping Route
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label:'Origin Country', field:'originCountry', placeholder:'e.g. China' },
                { label:'Origin Port / City', field:'originPort', placeholder:'e.g. Shanghai' },
                { label:'Destination Country', field:'destinationCountry', placeholder:'e.g. UAE' },
                { label:'Destination Port / City', field:'destinationPort', placeholder:'e.g. Jebel Ali' },
              ].map(inp => (
                <div key={inp.field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{inp.label}</label>
                  <input type="text" value={(form as any)[inp.field]} onChange={e => f(inp.field, e.target.value)}
                    placeholder={inp.placeholder} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Mode + Service */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shipping Mode</label>
              <select value={form.shippingMode} onChange={e => f('shippingMode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400">
                {SHIPPING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service Type</label>
              <select value={form.serviceType} onChange={e => f('serviceType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400">
                <option value="">— Select —</option>
                {['FCL','LCL','FTL','LTL','Bulk','Break Bulk','Express','Standard','Economy','Door to Door','Port to Port'].map(s =>
                  <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Incoterms</label>
              <select value={form.incoterms} onChange={e => f('incoterms', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400">
                <option value="">— Select —</option>
                {['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'].map(i =>
                  <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cargo Type</label>
              <select value={form.cargoType} onChange={e => f('cargoType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400">
                <option value="">— Select —</option>
                {['General','Hazardous','Perishable','Fragile','Oversized','Electronics','Automotive','Textiles','Chemicals','Food & Beverage','Machinery'].map(c =>
                  <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Cargo Details */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-violet-500" /> Cargo Details
            </h3>
            <div className="mb-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Cargo Description</label>
              <textarea rows={2} value={form.cargoDescription} onChange={e => f('cargoDescription', e.target.value)}
                placeholder="Describe the cargo contents..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Weight (kg)</label>
                <input type="number" value={form.weightKg} onChange={e => f('weightKg', e.target.value)}
                  placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Volume (CBM)</label>
                <input type="number" value={form.volumeCbm} onChange={e => f('volumeCbm', e.target.value)}
                  placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                <input type="number" value={form.quantity} onChange={e => f('quantity', e.target.value)}
                  placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {(form.shippingMode === 'sea') && <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Container Type</label>
                  <select value={form.containerType} onChange={e => f('containerType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">— Select —</option>
                    {["20'GP","40'GP","40'HC","20'RF","40'RF","20'OT","40'OT","Flat Rack","Tank"].map(c =>
                      <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Container Count</label>
                  <input type="number" value={form.containerCount} onChange={e => f('containerCount', e.target.value)}
                    placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </>}
            </div>
          </div>

          {/* Special Requirements */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">Special Requirements</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { field: 'hazardous', label: 'Hazardous / DG Cargo' },
                { field: 'temperatureControlled', label: 'Temperature Controlled' },
                { field: 'insuranceRequired', label: 'Insurance Required' },
                { field: 'customsClearanceRequired', label: 'Customs Clearance Required' },
              ].map(opt => (
                <label key={opt.field} className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={(form as any)[opt.field]} onChange={e => f(opt.field, e.target.checked)}
                    className="w-4 h-4 text-violet-600 rounded border-gray-300" />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cargo Ready Date</label>
              <input type="date" value={form.cargoReadyDate} onChange={e => f('cargoReadyDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Required Delivery Date</label>
              <input type="date" value={form.requiredDeliveryDate} onChange={e => f('requiredDeliveryDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          {/* Custom Fields Placeholder */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-yellow-800 mb-2">📋 Custom Logistics Fields</h3>
            <p className="text-xs text-yellow-700 mb-3">These fields are placeholders — you can define specific logistics requirements here.</p>
            <div className="space-y-2">
              {[
                { field: 'customField1', label: 'Custom Field 1 (e.g. HS Code)' },
                { field: 'customField2', label: 'Custom Field 2 (e.g. Commodity)' },
                { field: 'customField3', label: 'Custom Field 3 (e.g. Packing Type)' },
              ].map(cf => (
                <div key={cf.field}>
                  <label className="block text-xs font-medium text-yellow-700 mb-1">{cf.label}</label>
                  <input type="text" value={(form as any)[cf.field]} onChange={e => f(cf.field, e.target.value)}
                    placeholder="Enter value..." className="w-full px-3 py-2 border border-yellow-300 bg-white rounded-lg text-sm" />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Special Instructions / Notes</label>
            <textarea rows={3} value={form.notes} onChange={e => f('notes', e.target.value)}
              placeholder="Any additional instructions for the pricing team..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-violet-400" />
          </div>
        </div>

        <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {saving ? 'Submitting...' : 'Submit RFQ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deal Form Modal ────────────────────────────────────────────────────────
function DealFormModal({ deal, customers, onSave, onClose }: {
  deal?: Deal; customers: any[]; onSave: (data: any) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: deal?.title || '',
    customerId: deal?.customer_id || '',
    stage: deal?.stage || 'lead',
    value: deal?.value?.toString() || '',
    currency: deal?.currency || 'USD',
    probability: deal?.probability?.toString() || '10',
    expectedCloseDate: deal?.expected_close_date ? deal.expected_close_date.split('T')[0] : '',
    serviceType: deal?.service_type || '',
    shippingMode: deal?.shipping_mode || '',
    originCountry: deal?.origin_country || '',
    destinationCountry: deal?.destination_country || '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const probMap: Record<string,string> = { lead:'10', contacted:'25', rfq:'40', quotation:'55', negotiation:'75', won:'100', lost:'0' };

  const handleSave = async () => {
    if (!form.title || !form.customerId) return;
    setSaving(true);
    try {
      await onSave({
        title: form.title,
        customerId: form.customerId,
        stage: form.stage,
        value: parseFloat(form.value) || 0,
        currency: form.currency,
        probability: parseInt(form.probability) || undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
        serviceType: form.serviceType || undefined,
        shippingMode: form.shippingMode || undefined,
        originCountry: form.originCountry || undefined,
        destinationCountry: form.destinationCountry || undefined,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{deal ? 'Edit Deal' : 'New Deal'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Deal Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. FCL Shipment – Electronics Q1" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer *</label>
            <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">— Select Customer —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Stage</label>
              <select value={form.stage} onChange={e => {
                const s = e.target.value;
                setForm(f => ({ ...f, stage: s, probability: probMap[s] || f.probability }));
              }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Probability %</label>
              <input type="number" min="0" max="100" value={form.probability}
                onChange={e => setForm(f => ({ ...f, probability: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Deal Value</label>
              <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Shipping Mode</label>
              <select value={form.shippingMode} onChange={e => setForm(f => ({ ...f, shippingMode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">— Select —</option>
                {SHIPPING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Close</label>
              <input type="date" value={form.expectedCloseDate} onChange={e => setForm(f => ({ ...f, expectedCloseDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Origin Country</label>
              <input type="text" value={form.originCountry} onChange={e => setForm(f => ({ ...f, originCountry: e.target.value }))}
                placeholder="e.g. China" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Destination Country</label>
              <input type="text" value={form.destinationCountry} onChange={e => setForm(f => ({ ...f, destinationCountry: e.target.value }))}
                placeholder="e.g. UAE" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title || !form.customerId}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : deal ? 'Update Deal' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deal Card (Kanban) ────────────────────────────────────────────────────
function DealCard({ deal, isRTL, onOpen, onEdit, onDelete, onRFQ }: {
  deal: Deal; isRTL: boolean;
  onOpen: (d: Deal) => void; onEdit: (d: Deal) => void;
  onDelete: (id: string) => void; onRFQ: (d: Deal) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const stageCfg = STAGES.find(s => s.key === deal.stage);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
      onClick={() => onOpen(deal)}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-400 font-mono">{deal.deal_number}</span>
          <h4 className="text-sm font-semibold text-gray-900 leading-snug mt-0.5 line-clamp-2">{deal.title}</h4>
        </div>
        <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-300 hover:text-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-40 py-1">
              <button onClick={() => { onOpen(deal); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5" /> View Details
              </button>
              <button onClick={() => { onEdit(deal); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5" /> Edit Deal
              </button>
              {['lead','contacted','rfq'].includes(deal.stage) && (
                <button onClick={() => { onRFQ(deal); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-violet-700 hover:bg-violet-50 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> Submit RFQ
                </button>
              )}
              <div className="h-px bg-gray-100 my-1" />
              <button onClick={() => { onDelete(deal.id); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
        <Building2 className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{deal.customer_name || '—'}</span>
      </div>

      {(deal.origin_country || deal.destination_country) && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <Globe className="w-3 h-3" />
          <span>{deal.origin_country || '?'}</span>
          <ArrowRight className="w-2.5 h-2.5" />
          <span>{deal.destination_country || '?'}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-800">
          {deal.currency} {(deal.value || 0).toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{deal.probability}%</span>
          {(deal.rfq_count || 0) > 0 && (
            <span className="text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">
              {deal.rfq_count} RFQ
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stage Mover Modal ────────────────────────────────────────────────────────
function StageMoveModal({ deal, onMove, onClose }: {
  deal: Deal; onMove: (stage: string, reason?: string) => void; onClose: () => void;
}) {
  const [stage, setStage] = useState(deal.stage);
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Move Deal Stage</h3>
        <p className="text-sm text-gray-500 mb-3">Deal: <strong>{deal.deal_number} – {deal.title}</strong></p>
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-2">Select New Stage</label>
          <div className="space-y-2">
            {STAGES.map(s => (
              <button key={s.key} onClick={() => setStage(s.key)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 text-sm font-medium transition-all ${stage === s.key ? `border-blue-500 bg-blue-50 text-blue-700` : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                {s.label}
                {s.key === deal.stage && <span className="ml-auto text-xs text-gray-400">(current)</span>}
              </button>
            ))}
          </div>
        </div>
        {stage === 'lost' && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Loss Reason</label>
            <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Why was this deal lost?" className="w-full px-3 py-2 text-sm border border-red-200 bg-red-50 rounded-lg resize-none" />
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={() => onMove(stage, reason || undefined)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Move
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DealsPage() {
  const { user } = useAuth();
  const { isRTL } = useI18n();
  const router = useRouter();
  const isAdmin = ['Admin', 'Finance', 'Operations'].includes(user?.role || '');
  const isSales = user?.role === 'Sales';

  const [deals, setDeals] = useState<Deal[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, Deal[]>>({});
  const [pipelineSummary, setPipelineSummary] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [rfqDeal, setRfqDeal] = useState<Deal | null>(null);
  const [movingDeal, setMovingDeal] = useState<Deal | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dealsRes, custRes, pipeRes] = await Promise.all([
        dealsAPI.getAll({ limit: 500, search: search || undefined, stage: filterStage || undefined }),
        customersAPI.getAll({ limit: 200 }),
        dealsAPI.getPipeline(),
      ]);
      const allDeals: Deal[] = dealsRes.data?.data || [];
      setDeals(allDeals);
      // Build local pipeline
      const pipe: Record<string, Deal[]> = { lead:[], contacted:[], rfq:[], quotation:[], negotiation:[], won:[], lost:[] };
      allDeals.forEach(d => { if (pipe[d.stage]) pipe[d.stage].push(d); });
      setPipeline(pipe);
      setPipelineSummary(pipeRes.data?.data);
      setCustomers(custRes.data?.data || []);
    } finally { setLoading(false); }
  }, [search, filterStage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await dealsAPI.create(data);
      await fetchData();
      setShowCreateModal(false);
      showToast('Deal created!');
    } catch { showToast('Failed to create deal', 'error'); }
  };

  const handleUpdate = async (data: any) => {
    if (!editingDeal) return;
    try {
      await dealsAPI.update(editingDeal.id, data);
      await fetchData();
      setEditingDeal(null);
      showToast('Deal updated!');
    } catch { showToast('Failed to update deal', 'error'); }
  };

  const handleMove = async (stage: string, reason?: string) => {
    if (!movingDeal) return;
    try {
      await dealsAPI.updateStage(movingDeal.id, { stage, lossReason: reason });
      await fetchData();
      setMovingDeal(null);
      showToast(`Deal moved to ${stage}`);
    } catch { showToast('Failed to move deal', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await dealsAPI.delete(id);
      await fetchData();
      setDeletingId(null);
      showToast('Deal deleted');
    } catch { showToast('Failed to delete deal', 'error'); }
  };

  const handleRFQSubmitted = async () => {
    setRfqDeal(null);
    await fetchData();
    showToast('RFQ submitted successfully!');
  };

  // Pipeline totals
  const totalPipelineValue = deals.filter(d => !['won','lost'].includes(d.stage))
    .reduce((s, d) => s + (d.value || 0), 0);
  const wonValue = deals.filter(d => d.stage === 'won').reduce((s, d) => s + (d.value || 0), 0);

  return (
    <MainLayout>
      <div className="p-6 max-w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isSales ? 'Your deals and leads' : 'All deals across the company'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => setView('kanban')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${view === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <Layers className="w-4 h-4" />
              </button>
              <button onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm">
              <Plus className="w-4 h-4" /> New Deal
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Deals',    val: deals.length,                  icon: Briefcase,  color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: 'Pipeline Value', val: `$${totalPipelineValue.toLocaleString()}`, icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Won Value',      val: `$${wonValue.toLocaleString()}`,icon: CheckCircle2,color:'text-green-600',  bg: 'bg-green-50' },
            { label: 'Active Stages',  val: deals.filter(d => !['won','lost'].includes(d.stage)).length, icon: TrendingUp, color:'text-orange-600', bg:'bg-orange-50' },
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

        {/* Search + Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search deals, customers..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500">
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : view === 'kanban' ? (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {STAGES.map(stage => {
                const stageDeals = pipeline[stage.key] || [];
                const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
                return (
                  <div key={stage.key} className="w-72 flex-shrink-0">
                    {/* Stage Header */}
                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl border border-b-0 ${stage.color}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                        <span className={`text-sm font-bold ${stage.header.split(' ')[1]}`}>{stage.label}</span>
                        <span className="text-xs bg-white/60 px-1.5 py-0.5 rounded-full font-semibold">{stageDeals.length}</span>
                      </div>
                      <span className="text-xs font-semibold opacity-70">${stageValue.toLocaleString()}</span>
                    </div>
                    {/* Stage Body */}
                    <div className={`min-h-[200px] rounded-b-xl border ${stage.color} p-2 space-y-2`}>
                      {stageDeals.map(deal => (
                        <DealCard key={deal.id} deal={deal} isRTL={isRTL}
                          onOpen={d => router.push(`/deals/${d.id}`)}
                          onEdit={d => setEditingDeal(d)}
                          onDelete={id => setDeletingId(id)}
                          onRFQ={d => setRfqDeal(d)}
                        />
                      ))}
                      {stageDeals.length === 0 && (
                        <div className="text-center py-8 text-xs text-gray-400">
                          <Target className="w-6 h-6 mx-auto mb-1 opacity-40" />
                          No deals
                        </div>
                      )}
                      {/* Add to this stage */}
                      <button onClick={() => setShowCreateModal(true)}
                        className="w-full py-2 text-xs text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg border border-dashed border-gray-200 hover:border-blue-300 flex items-center justify-center gap-1 transition-all">
                        <Plus className="w-3.5 h-3.5" /> Add Deal
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Deal</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Route</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map(deal => {
                  const stageCfg = STAGES.find(s => s.key === deal.stage);
                  return (
                    <tr key={deal.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/deals/${deal.id}`)}>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-xs text-gray-400 font-mono">{deal.deal_number}</span>
                          <div className="font-medium text-gray-900">{deal.title}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{deal.customer_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${stageCfg?.header}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${stageCfg?.dot}`} />
                          {stageCfg?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {deal.currency} {(deal.value || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {deal.origin_country && deal.destination_country
                          ? `${deal.origin_country} → ${deal.destination_country}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setMovingDeal(deal)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded" title="Move Stage">
                            <Move className="w-3.5 h-3.5" />
                          </button>
                          {['lead','contacted','rfq'].includes(deal.stage) && (
                            <button onClick={() => setRfqDeal(deal)}
                              className="p-1.5 text-gray-400 hover:text-violet-500 hover:bg-violet-50 rounded" title="Submit RFQ">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setEditingDeal(deal)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeletingId(deal.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {deals.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No deals found</p>
              </div>
            )}
          </div>
        )}

        {/* Modals */}
        {showCreateModal && (
          <DealFormModal customers={customers} onSave={handleCreate} onClose={() => setShowCreateModal(false)} />
        )}
        {editingDeal && (
          <DealFormModal deal={editingDeal} customers={customers} onSave={handleUpdate} onClose={() => setEditingDeal(null)} />
        )}
        {rfqDeal && (
          <RFQFormModal deal={rfqDeal} onClose={() => setRfqDeal(null)} onSubmit={handleRFQSubmitted} />
        )}
        {movingDeal && (
          <StageMoveModal deal={movingDeal} onMove={handleMove} onClose={() => setMovingDeal(null)} />
        )}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
              <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">Delete Deal?</h3>
              <p className="text-sm text-gray-500 mb-5">All linked RFQs, quotations, and activities will be deleted.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setDeletingId(null)} className="px-5 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
                <button onClick={() => handleDelete(deletingId)} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">Delete</button>
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
