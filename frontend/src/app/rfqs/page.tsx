'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { rfqsAPI, customersAPI, dealsAPI } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Search, RefreshCw, FileText, X, CheckCircle2, AlertCircle,
  Edit3, Eye, Globe, Ship, Plane, Package, Building2, Calendar,
  ExternalLink, ArrowRight, ChevronDown, ChevronUp, Truck, Train,
  Thermometer, AlertTriangle, Shield, Clipboard, Anchor, Wind,
  Star, Clock, DollarSign, Layers, Tag, Info
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; labelAr: string }> = {
  pending:     { label: 'Pending',     labelAr: 'في الانتظار',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  sent_to_ops: { label: 'Sent to Ops', labelAr: 'أُرسل للعمليات', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  pricing:     { label: 'Pricing',     labelAr: 'التسعير',        color: 'bg-violet-100 text-violet-700 border-violet-200' },
  quoted:      { label: 'Quoted',      labelAr: 'تم التسعير',     color: 'bg-green-100 text-green-700 border-green-200' },
  approved:    { label: 'Approved',    labelAr: 'موافق عليه',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:    { label: 'Rejected',    labelAr: 'مرفوض',          color: 'bg-red-100 text-red-700 border-red-200' },
};

const SHIPPING_MODE_ICONS: Record<string, React.ElementType> = {
  sea: Ship, air: Plane, road: Truck, rail: Train, multimodal: Globe
};

const INCOTERMS = ['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'];
const CONTAINER_TYPES = ['20GP','40GP','40HC','20RF','40RF','20OT','40OT','20FR','40FR','LCL'];
const CARGO_TYPES = ['General Cargo','Electronics','Textiles','Food & Beverage','Chemicals','Machinery','Automotive','Pharmaceuticals','Steel/Metal','Construction Materials','Other'];
const VALUE_ADDED_SERVICES = [
  { key: 'customs_clearance', label: 'Customs Clearance', labelAr: 'التخليص الجمركي', icon: Clipboard },
  { key: 'insurance',         label: 'Cargo Insurance',   labelAr: 'تأمين البضائع',    icon: Shield },
  { key: 'door_pickup',       label: 'Door Pickup',        labelAr: 'استلام من الباب',   icon: Package },
  { key: 'door_delivery',     label: 'Door Delivery',      labelAr: 'تسليم للباب',       icon: Package },
  { key: 'warehousing',       label: 'Warehousing',        labelAr: 'التخزين',            icon: Layers },
  { key: 'packing',           label: 'Packing Services',   labelAr: 'خدمات التعبئة',     icon: Package },
  { key: 'fumigation',        label: 'Fumigation',         labelAr: 'التدخين',            icon: Wind },
  { key: 'survey',            label: 'Cargo Survey',       labelAr: 'فحص البضائع',       icon: Eye },
];

// ─── Multi-Step RFQ Form ─────────────────────────────────────────────────────
function RFQFormModal({ onClose, onCreated, prefillDealId, customers, deals }: {
  onClose: () => void; onCreated: () => void;
  prefillDealId?: string; customers: any[]; deals: any[];
}) {
  const { user } = useAuth();
  const { t, isRTL } = useI18n();
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 7;

  const [form, setForm] = useState({
    // Deal Link
    dealId: prefillDealId || '',
    customerId: '',
    // 1. Shipment Basics
    shippingMode: 'sea',
    serviceType: '',
    incoterms: '',
    cargoReadyDate: '',
    requiredDeliveryDate: '',
    // 2. Route Information
    originCountry: '',
    originPort: '',
    originAddress: '',
    destinationCountry: '',
    destinationPort: '',
    destinationAddress: '',
    // 3. Container Details (FCL only)
    containerType: '',
    containerCount: '',
    containerType2: '',
    containerCount2: '',
    // 4. Cargo Specifications
    cargoType: '',
    cargoDescription: '',
    weightKg: '',
    volumeCbm: '',
    quantity: '',
    unitType: 'CBM',
    // 5. Cargo Nature
    stackable: true,
    fragile: false,
    oversized: false,
    dimensionsLwh: '',
    temperatureControlled: false,
    tempRange: '',
    // 6. Special Cargo
    hazardous: false,
    hazmatClass: '',
    unNumber: '',
    imoClass: '',
    packingGroup: '',
    flashPoint: '',
    perishable: false,
    perishableType: '',
    // 7. Trade Terms & VAS
    insuranceRequired: false,
    customsClearanceRequired: false,
    valueAddedServices: [] as string[],
    // Other
    specialInstructions: '',
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const f = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  // Auto-fill from deal
  useEffect(() => {
    if (form.dealId) {
      const deal = deals.find(d => d.id === form.dealId);
      if (deal) {
        setForm(p => ({
          ...p,
          customerId: deal.customer_id || p.customerId,
          originCountry: deal.origin_country || p.originCountry,
          originPort: deal.origin_port || p.originPort,
          destinationCountry: deal.destination_country || p.destinationCountry,
          destinationPort: deal.destination_port || p.destinationPort,
          shippingMode: deal.shipping_mode || p.shippingMode,
          serviceType: deal.service_type || p.serviceType,
          incoterms: deal.incoterms || p.incoterms,
          cargoType: deal.cargo_type || p.cargoType,
        }));
      }
    }
  }, [form.dealId]);

  const toggleVAS = (key: string) => {
    setForm(p => ({
      ...p,
      valueAddedServices: p.valueAddedServices.includes(key)
        ? p.valueAddedServices.filter(v => v !== key)
        : [...p.valueAddedServices, key]
    }));
  };

  const validateStep = (): boolean => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      if (!form.customerId) errs.customerId = 'Customer is required';
      if (!form.shippingMode) errs.shippingMode = 'Shipping mode is required';
    }
    if (step === 2) {
      if (!form.originCountry) errs.originCountry = 'Origin country is required';
      if (!form.destinationCountry) errs.destinationCountry = 'Destination country is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => { if (validateStep()) setStep(s => Math.min(s + 1, TOTAL_STEPS)); };
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true);
    try {
      await rfqsAPI.create({
        ...form,
        weightKg: form.weightKg ? parseFloat(form.weightKg) : undefined,
        volumeCbm: form.volumeCbm ? parseFloat(form.volumeCbm) : undefined,
        quantity: form.quantity ? parseInt(form.quantity) : undefined,
        containerCount: form.containerCount ? parseInt(form.containerCount) : undefined,
        containerCount2: form.containerCount2 ? parseInt(form.containerCount2) : undefined,
        dealId: form.dealId || undefined,
        cargoNature: {
          stackable: form.stackable,
          fragile: form.fragile,
          oversized: form.oversized,
          temperatureControlled: form.temperatureControlled,
        },
        customFields: {},
      });
      onCreated();
    } catch (e: any) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const isFCL = form.serviceType === 'FCL';
  const stepTitles = ['Shipment Basics','Route Information','Container Details','Cargo Specifications','Cargo Nature','Special Cargo','Trade Terms & Services'];
  const stepTitlesAr = ['أساسيات الشحن','معلومات المسار','تفاصيل الحاويات','مواصفات البضاعة','طبيعة البضاعة','بضائع خاصة','الشروط والخدمات'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isRTL ? 'طلب عرض سعر جديد' : 'New RFQ'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isRTL ? stepTitlesAr[step - 1] : stepTitles[step - 1]} · {isRTL ? `الخطوة ${step} من ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-3">
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < step ? 'bg-violet-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* STEP 1: Shipment Basics */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الصفقة المرتبطة' : 'Linked Deal'}</label>
                  <select value={form.dealId} onChange={e => f('dealId', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="">{isRTL ? '— اختياري —' : '— Optional —'}</option>
                    {deals.map(d => <option key={d.id} value={d.id}>{d.deal_number} · {d.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    {isRTL ? 'العميل' : 'Customer'} <span className="text-red-500">*</span>
                  </label>
                  <select value={form.customerId} onChange={e => f('customerId', e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 ${errors.customerId ? 'border-red-400' : 'border-gray-300'}`}>
                    <option value="">{isRTL ? 'اختر العميل...' : 'Select customer...'}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                  {errors.customerId && <p className="text-red-500 text-xs mt-1">{errors.customerId}</p>}
                </div>
              </div>

              {/* Shipping Mode */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  {isRTL ? 'نوع الشحن' : 'Shipping Mode'} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(['sea','air','road','rail','multimodal'] as const).map(mode => {
                    const Icon = SHIPPING_MODE_ICONS[mode] || Globe;
                    const labels: Record<string, string> = { sea: 'Sea', air: 'Air', road: 'Road', rail: 'Rail', multimodal: 'Multi' };
                    return (
                      <button key={mode} type="button" onClick={() => f('shippingMode', mode)}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 text-xs font-medium transition-all ${
                          form.shippingMode === mode ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 hover:border-violet-300'}`}>
                        <Icon className="w-5 h-5" />
                        {labels[mode]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'نوع الخدمة' : 'Service Type'}</label>
                  <select value={form.serviceType} onChange={e => f('serviceType', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                    <option value="FCL">FCL – Full Container Load</option>
                    <option value="LCL">LCL – Less Container Load</option>
                    <option value="Bulk">Bulk Cargo</option>
                    <option value="RoRo">RoRo – Roll-on/Roll-off</option>
                    <option value="Express">Express / Courier</option>
                    <option value="Charter">Charter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Incoterms</label>
                  <select value={form.incoterms} onChange={e => f('incoterms', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="">Select...</option>
                    {INCOTERMS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{isRTL ? 'تاريخ جاهزية البضاعة' : 'Cargo Ready Date'}
                  </label>
                  <input type="date" value={form.cargoReadyDate} onChange={e => f('cargoReadyDate', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />{isRTL ? 'تاريخ التسليم المطلوب' : 'Required Delivery Date'}
                  </label>
                  <input type="date" value={form.requiredDeliveryDate} onChange={e => f('requiredDeliveryDate', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Route Information */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                  <Anchor className="w-4 h-4" /> {isRTL ? 'بلد/ميناء المنشأ' : 'Origin'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{isRTL ? 'البلد' : 'Country'} <span className="text-red-500">*</span></label>
                    <input type="text" value={form.originCountry} onChange={e => f('originCountry', e.target.value)}
                      placeholder="e.g. China" className={`w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 ${errors.originCountry ? 'border-red-400' : 'border-gray-300'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{isRTL ? 'الميناء' : 'Port'}</label>
                    <input type="text" value={form.originPort} onChange={e => f('originPort', e.target.value)}
                      placeholder="e.g. Shanghai (SHA)" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{isRTL ? 'العنوان التفصيلي' : 'Full Address'}</label>
                  <input type="text" value={form.originAddress} onChange={e => f('originAddress', e.target.value)}
                    placeholder="Street address, city..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-16 h-px bg-gray-300" />
                  <ArrowRight className="w-5 h-5" />
                  <div className="w-16 h-px bg-gray-300" />
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h3 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> {isRTL ? 'بلد/ميناء الوجهة' : 'Destination'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{isRTL ? 'البلد' : 'Country'} <span className="text-red-500">*</span></label>
                    <input type="text" value={form.destinationCountry} onChange={e => f('destinationCountry', e.target.value)}
                      placeholder="e.g. Saudi Arabia" className={`w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 ${errors.destinationCountry ? 'border-red-400' : 'border-gray-300'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{isRTL ? 'الميناء' : 'Port'}</label>
                    <input type="text" value={form.destinationPort} onChange={e => f('destinationPort', e.target.value)}
                      placeholder="e.g. Jeddah (JED)" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{isRTL ? 'العنوان التفصيلي' : 'Full Address'}</label>
                  <input type="text" value={form.destinationAddress} onChange={e => f('destinationAddress', e.target.value)}
                    placeholder="Street address, city..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Container Details */}
          {step === 3 && (
            <div className="space-y-4">
              {!isFCL && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    {isRTL
                      ? 'تفاصيل الحاويات تنطبق فقط على شحنات FCL. اختر FCL كنوع الخدمة أو أكمل مع LCL/أنواع أخرى.'
                      : 'Container details apply primarily to FCL shipments. You selected a different service type — fill in what\'s applicable.'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'نوع الحاوية الأولى' : 'Container Type 1'}</label>
                  <select value={form.containerType} onChange={e => f('containerType', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="">Select...</option>
                    {CONTAINER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'عدد الحاويات' : 'Count'}</label>
                  <input type="number" min="1" value={form.containerCount} onChange={e => f('containerCount', e.target.value)}
                    placeholder="1" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{isRTL ? 'حاوية ثانية (اختياري)' : 'Second container (optional)'}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'نوع الحاوية الثانية' : 'Container Type 2'}</label>
                  <select value={form.containerType2} onChange={e => f('containerType2', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="">None</option>
                    {CONTAINER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'عدد الحاويات' : 'Count'}</label>
                  <input type="number" min="1" value={form.containerCount2} onChange={e => f('containerCount2', e.target.value)}
                    placeholder="—" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Cargo Specifications */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'نوع البضائع' : 'Cargo Type'}</label>
                  <select value={form.cargoType} onChange={e => f('cargoType', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="">Select...</option>
                    {CARGO_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'وحدة القياس' : 'Unit Type'}</label>
                  <select value={form.unitType} onChange={e => f('unitType', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400">
                    <option value="CBM">CBM</option>
                    <option value="Pallets">Pallets</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Pieces">Pieces</option>
                    <option value="Tons">Tons</option>
                    <option value="Containers">Containers</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'وصف البضاعة' : 'Cargo Description'}</label>
                <textarea value={form.cargoDescription} onChange={e => f('cargoDescription', e.target.value)}
                  placeholder="Detailed description of goods, HS codes if available..." rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الوزن (كجم)' : 'Weight (kg)'}</label>
                  <input type="number" min="0" step="0.01" value={form.weightKg} onChange={e => f('weightKg', e.target.value)}
                    placeholder="0.00" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الحجم (م³)' : 'Volume (CBM)'}</label>
                  <input type="number" min="0" step="0.01" value={form.volumeCbm} onChange={e => f('volumeCbm', e.target.value)}
                    placeholder="0.00" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الكمية' : 'Quantity'}</label>
                  <input type="number" min="1" value={form.quantity} onChange={e => f('quantity', e.target.value)}
                    placeholder="1" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Cargo Nature */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'stackable',   label: 'Stackable',          labelAr: 'قابل للتكديس',    icon: Layers,       desc: 'Cargo can be stacked' },
                  { key: 'fragile',     label: 'Fragile',            labelAr: 'قابل للكسر',      icon: AlertCircle,  desc: 'Handle with care' },
                  { key: 'oversized',   label: 'Oversized / OOG',    labelAr: 'أبعاد ضخمة',      icon: Package,      desc: 'Out-of-gauge cargo' },
                  { key: 'temperatureControlled', label: 'Temp. Controlled', labelAr: 'مبرد/متحكم به', icon: Thermometer, desc: 'Requires temperature control' },
                ] as const).map(({ key, label, labelAr, icon: Icon, desc }) => (
                  <button key={key} type="button"
                    onClick={() => f(key as string, !(form as any)[key])}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      (form as any)[key] ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300 bg-white'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-5 h-5 ${(form as any)[key] ? 'text-violet-600' : 'text-gray-400'}`} />
                      <span className={`text-sm font-semibold ${(form as any)[key] ? 'text-violet-700' : 'text-gray-700'}`}>
                        {isRTL ? labelAr : label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </button>
                ))}
              </div>

              {form.temperatureControlled && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'نطاق درجة الحرارة' : 'Temperature Range'}</label>
                  <input type="text" value={form.tempRange} onChange={e => f('tempRange', e.target.value)}
                    placeholder="e.g. 2-8°C / -18°C to -22°C"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              )}

              {form.oversized && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isRTL ? 'الأبعاد (ط × ع × ا سم)' : 'Dimensions L×W×H (cm)'}</label>
                  <input type="text" value={form.dimensionsLwh} onChange={e => f('dimensionsLwh', e.target.value)}
                    placeholder="e.g. 600 × 240 × 280 cm"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400" />
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Special Cargo */}
          {step === 6 && (
            <div className="space-y-4">
              {/* Dangerous Goods */}
              <div className={`rounded-xl border-2 p-4 transition-all ${form.hazardous ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-5 h-5 ${form.hazardous ? 'text-red-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-bold text-gray-800">{isRTL ? 'بضائع خطرة (DG)' : 'Dangerous Goods (DG / Hazmat)'}</span>
                  </div>
                  <button type="button" onClick={() => f('hazardous', !form.hazardous)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${form.hazardous ? 'bg-red-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.hazardous ? (isRTL ? 'left-1' : 'left-7') : (isRTL ? 'left-7' : 'left-1')}`} />
                  </button>
                </div>

                {form.hazardous && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">UN Number</label>
                      <input type="text" value={form.unNumber} onChange={e => f('unNumber', e.target.value)}
                        placeholder="e.g. UN1234" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">IMO Class</label>
                      <select value={form.imoClass} onChange={e => f('imoClass', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400">
                        <option value="">Select class...</option>
                        {['1','1.4','2.1','2.2','2.3','3','4.1','4.2','4.3','5.1','5.2','6.1','6.2','7','8','9'].map(c => <option key={c} value={c}>Class {c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Packing Group</label>
                      <select value={form.packingGroup} onChange={e => f('packingGroup', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400">
                        <option value="">—</option>
                        <option value="I">Group I (High Danger)</option>
                        <option value="II">Group II (Medium Danger)</option>
                        <option value="III">Group III (Minor Danger)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Flash Point (°C)</label>
                      <input type="text" value={form.flashPoint} onChange={e => f('flashPoint', e.target.value)}
                        placeholder="e.g. 23°C" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-600 mb-1">Hazmat Class Description</label>
                      <input type="text" value={form.hazmatClass} onChange={e => f('hazmatClass', e.target.value)}
                        placeholder="e.g. Flammable liquids" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400" />
                    </div>
                  </div>
                )}
              </div>

              {/* Perishable */}
              <div className={`rounded-xl border-2 p-4 transition-all ${form.perishable ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Thermometer className={`w-5 h-5 ${form.perishable ? 'text-cyan-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-bold text-gray-800">{isRTL ? 'بضائع قابلة للتلف' : 'Perishable Goods'}</span>
                  </div>
                  <button type="button" onClick={() => f('perishable', !form.perishable)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${form.perishable ? 'bg-cyan-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.perishable ? (isRTL ? 'left-1' : 'left-7') : (isRTL ? 'left-7' : 'left-1')}`} />
                  </button>
                </div>
                {form.perishable && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">{isRTL ? 'نوع البضاعة القابلة للتلف' : 'Perishable Type'}</label>
                    <select value={form.perishableType} onChange={e => f('perishableType', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-400">
                      <option value="">Select type...</option>
                      <option value="Fresh Produce">Fresh Produce / Fruits & Vegetables</option>
                      <option value="Dairy">Dairy Products</option>
                      <option value="Meat & Poultry">Meat & Poultry</option>
                      <option value="Seafood">Seafood</option>
                      <option value="Pharmaceuticals">Pharmaceuticals</option>
                      <option value="Flowers">Flowers & Plants</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 7: Trade Terms & Value-Added Services */}
          {step === 7 && (
            <div className="space-y-4">
              {/* Value Added Services */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  {isRTL ? 'الخدمات الإضافية المطلوبة' : 'Value-Added Services Required'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {VALUE_ADDED_SERVICES.map(({ key, label, labelAr, icon: Icon }) => (
                    <button key={key} type="button" onClick={() => toggleVAS(key)}
                      className={`p-3 rounded-xl border-2 flex items-center gap-2.5 transition-all ${
                        form.valueAddedServices.includes(key) ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 hover:border-violet-300 text-gray-600'}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium">{isRTL ? labelAr : label}</span>
                      {form.valueAddedServices.includes(key) && <CheckCircle2 className="w-4 h-4 ms-auto flex-shrink-0 text-violet-600" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">{isRTL ? 'تعليمات خاصة' : 'Special Instructions'}</label>
                <textarea value={form.specialInstructions} onChange={e => f('specialInstructions', e.target.value)}
                  placeholder="Any special handling requirements, preferences, or notes for operations..." rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">{isRTL ? 'ملاحظات' : 'Internal Notes'}</label>
                <textarea value={form.notes} onChange={e => f('notes', e.target.value)}
                  placeholder="Internal notes for your team..." rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">{isRTL ? 'ملخص الطلب' : 'Request Summary'}</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span className="font-medium">{isRTL ? 'الشحن:' : 'Mode:'}</span><span className="capitalize">{form.shippingMode} {form.serviceType && `· ${form.serviceType}`}</span>
                  <span className="font-medium">{isRTL ? 'المسار:' : 'Route:'}</span><span>{form.originCountry || '—'} → {form.destinationCountry || '—'}</span>
                  {form.weightKg && <><span className="font-medium">{isRTL ? 'الوزن:' : 'Weight:'}</span><span>{form.weightKg} kg</span></>}
                  {form.volumeCbm && <><span className="font-medium">{isRTL ? 'الحجم:' : 'Volume:'}</span><span>{form.volumeCbm} CBM</span></>}
                  {form.hazardous && <><span className="font-medium text-red-600">⚠️ {isRTL ? 'خطر:' : 'Hazardous:'}</span><span>UN {form.unNumber} Class {form.imoClass}</span></>}
                  {form.perishable && <><span className="font-medium text-cyan-600">❄️ {isRTL ? 'قابل للتلف:' : 'Perishable:'}</span><span>{form.perishableType}</span></>}
                  {form.valueAddedServices.length > 0 && <><span className="font-medium">{isRTL ? 'خدمات:' : 'VAS:'}</span><span>{form.valueAddedServices.length} selected</span></>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={step === 1 ? onClose : handleBack}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
            {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'السابق' : 'Back')}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{step}/{TOTAL_STEPS}</span>
            {step < TOTAL_STEPS ? (
              <button onClick={handleNext}
                className="px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
                {isRTL ? 'التالي ←' : 'Next →'}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving}
                className="px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isRTL ? 'إرسال الطلب' : 'Submit RFQ'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main RFQ Page ────────────────────────────────────────────────────────────
function RFQsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, isRTL } = useI18n();
  const prefillDealId = searchParams.get('dealId');

  const isSales = user?.role === 'Sales';
  const isOps = user?.role === 'Operations';
  const isAdmin = ['Admin', 'Finance', 'Operations'].includes(user?.role || '');

  const [rfqs, setRfqs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(!!prefillDealId);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [expandedRFQ, setExpandedRFQ] = useState<string | null>(null);

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

  const canCreate = isSales || user?.role === 'Admin';

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isRTL ? 'طلبات عروض الأسعار' : 'RFQ Management'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{isRTL ? 'طلبات عروض الأسعار لعمليات اللوجستيات' : 'Request for Quotation — logistics pricing requests'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            {canCreate && (
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 shadow-sm">
                <Plus className="w-4 h-4" /> {isRTL ? 'طلب جديد' : 'New RFQ'}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = rfqs.filter(r => r.status === key).length;
            return (
              <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                className={`p-3 rounded-xl border text-center transition-all ${filterStatus === key ? 'border-violet-400 bg-violet-50' : 'bg-white border-gray-200 hover:border-violet-200'}`}>
                <div className="text-xl font-bold text-gray-800 ltr-num">{count}</div>
                <div className={`text-xs font-medium mt-1 px-1.5 py-0.5 rounded-full inline-block ${cfg.color}`}>
                  {isRTL ? cfg.labelAr : cfg.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={isRTL ? 'بحث برقم الطلب، العميل، المسار...' : 'Search by RFQ#, customer, route...'}
            className="w-full ps-9 pe-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400" />
        </div>

        {/* RFQ List */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 text-violet-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{isRTL ? 'لا توجد طلبات' : 'No RFQs found'}</p>
            {canCreate && (
              <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-violet-600 hover:underline">
                {isRTL ? 'إنشاء أول طلب ←' : 'Create your first RFQ →'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(rfq => {
              const statusCfg = STATUS_CONFIG[rfq.status] || STATUS_CONFIG.pending;
              const ModeIcon = SHIPPING_MODE_ICONS[rfq.shipping_mode] || Globe;
              const isExpanded = expandedRFQ === rfq.id;
              return (
                <div key={rfq.id} className="bg-white border border-gray-200 rounded-2xl hover:border-violet-200 hover:shadow-sm transition-all">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-sm font-bold font-mono text-gray-500">{rfq.rfq_number}</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${statusCfg.color}`}>
                            {isRTL ? statusCfg.labelAr : statusCfg.label}
                          </span>
                          {rfq.deal_number && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              Deal: {rfq.deal_number}
                            </span>
                          )}
                          {rfq.hazardous && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200">⚠️ DG</span>}
                          {rfq.temperature_controlled && <span className="text-xs bg-cyan-100 text-cyan-600 px-2 py-0.5 rounded-full border border-cyan-200">❄️ Temp</span>}
                          {rfq.perishable && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200">🌡️ Perishable</span>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700 font-medium mb-3">
                          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          {rfq.customer_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <ModeIcon className="w-4 h-4 text-gray-400" />
                            <span className="capitalize">{rfq.shipping_mode}</span>
                            {rfq.service_type && <span className="text-xs text-gray-400">({rfq.service_type})</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-gray-400" />
                            <span>{rfq.origin_country} {rfq.origin_port && `(${rfq.origin_port})`}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span>{rfq.destination_country} {rfq.destination_port && `(${rfq.destination_port})`}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {rfq.weight_kg && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{rfq.weight_kg} kg</span>}
                          {rfq.volume_cbm && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{rfq.volume_cbm} CBM</span>}
                          {rfq.cargo_type && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{rfq.cargo_type}</span>}
                          {rfq.incoterms && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">{rfq.incoterms}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end flex-shrink-0">
                        <span className="text-xs text-gray-400">{new Date(rfq.created_at).toLocaleDateString()}</span>
                        {(isAdmin || isOps) && (
                          <select value={rfq.status} onChange={e => handleStatusUpdate(rfq.id, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-violet-400">
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex gap-1">
                          {rfq.deal_id && (
                            <button onClick={() => router.push(`/deals/${rfq.deal_id}`)}
                              className="text-xs text-violet-600 hover:bg-violet-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors">
                              <ExternalLink className="w-3 h-3" /> Deal
                            </button>
                          )}
                          {(isAdmin || (user?.role === 'Operations' && rfq.status === 'sent_to_ops')) && rfq.deal_id && (
                            <button onClick={() => router.push(`/quotations?dealId=${rfq.deal_id}&rfqId=${rfq.id}`)}
                              className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors border border-green-200">
                              <DollarSign className="w-3 h-3" /> Quote
                            </button>
                          )}
                          <button onClick={() => setExpandedRFQ(isExpanded ? null : rfq.id)}
                            className="text-xs text-gray-500 hover:bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-0 border-t border-gray-100 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                        {rfq.cargo_ready_date && (
                          <div className="text-xs">
                            <span className="text-gray-400 block">{isRTL ? 'تاريخ جاهزية البضاعة' : 'Cargo Ready'}</span>
                            <span className="font-medium text-gray-700">{new Date(rfq.cargo_ready_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {rfq.required_delivery_date && (
                          <div className="text-xs">
                            <span className="text-gray-400 block">{isRTL ? 'تاريخ التسليم المطلوب' : 'Required Delivery'}</span>
                            <span className="font-medium text-gray-700">{new Date(rfq.required_delivery_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {rfq.container_type && (
                          <div className="text-xs">
                            <span className="text-gray-400 block">{isRTL ? 'الحاوية' : 'Container'}</span>
                            <span className="font-medium text-gray-700">{rfq.container_count}× {rfq.container_type}</span>
                          </div>
                        )}
                        {rfq.submitted_by_name && (
                          <div className="text-xs">
                            <span className="text-gray-400 block">{isRTL ? 'قدم الطلب' : 'Submitted by'}</span>
                            <span className="font-medium text-gray-700">{rfq.submitted_by_name}</span>
                          </div>
                        )}
                      </div>

                      {rfq.value_added_services && rfq.value_added_services.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-400 block mb-1">{isRTL ? 'خدمات إضافية:' : 'Value-Added Services:'}</span>
                          <div className="flex flex-wrap gap-1">
                            {rfq.value_added_services.map((vas: string) => {
                              const service = VALUE_ADDED_SERVICES.find(v => v.key === vas);
                              return service ? (
                                <span key={vas} className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
                                  {isRTL ? service.labelAr : service.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}

                      {rfq.special_instructions && (
                        <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800 border border-amber-200">
                          <span className="font-semibold block mb-1">⚠️ {isRTL ? 'تعليمات خاصة:' : 'Special Instructions:'}</span>
                          {rfq.special_instructions}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                        <span>
                          {rfq.quotation_count > 0 && (
                            <span className="text-green-600 font-medium">{rfq.quotation_count} quotation{rfq.quotation_count > 1 ? 's' : ''} submitted</span>
                          )}
                        </span>
                        <span>ID: {rfq.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-4 end-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <RFQFormModal
            onClose={() => setShowForm(false)}
            onCreated={() => { setShowForm(false); fetchData(); showToast(isRTL ? 'تم إرسال الطلب بنجاح!' : 'RFQ submitted successfully!'); }}
            prefillDealId={prefillDealId || undefined}
            customers={customers}
            deals={deals}
          />
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
