'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import MainLayout from '@/components/layout/MainLayout';

// ─── Touch-drag global state ──────────────────────────────────────────────────
type TouchDragState = {
  itemId: string;
  itemType: string;
  currentStage: string;
  ghostEl: HTMLElement | null;
};
let _touchDrag: TouchDragState | null = null;
function startTouchDrag(state: TouchDragState) { _touchDrag = state; }
function getTouchDrag() { return _touchDrag; }
function endTouchDrag() { _touchDrag = null; }

import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/lib/i18n';
import { dealsAPI, customersAPI, rfqsAPI, leadsAPI } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, RefreshCw, Search, X, DollarSign, Building2,
  ArrowRight, User, Phone, Mail, Calendar, FileText,
  CheckCircle2, AlertCircle, MoreHorizontal,
  TrendingUp, Target, Globe,
  Eye, ExternalLink, ChevronRight, Layers,
  Users, Briefcase, Award,
  XCircle, ThumbsUp, Package,
  ShieldCheck, Zap, RotateCcw, ArrowRightCircle
} from 'lucide-react';

// ─── Undo history entry ───────────────────────────────────────────────────────
interface HistoryEntry {
  id: string;
  itemId: string;
  itemType: 'lead' | 'deal';
  itemName: string;
  fromStage: string;
  toStage: string;
  previousValue: Record<string, unknown>; // previous API fields to restore
  timestamp: number;
}

// ─── Unified Pipeline Stages ─────────────────────────────────────────────────
const WORKSPACE_STAGES = [
  {
    key: 'my_leads',
    label: 'My Leads',
    labelAr: 'عملاء محتملون',
    color: 'border-slate-300 bg-slate-50',
    header: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    accent: '#64748b',
    entityType: 'lead',
    leadStatuses: ['new'],
    dealStages: [],
    description: 'New leads assigned to you',
    descriptionAr: 'عملاء محتملون جدد مُعيَّنون لك',
  },
  {
    key: 'contact_attempt',
    label: 'Contact Attempt',
    labelAr: 'محاولة التواصل',
    color: 'border-blue-200 bg-blue-50',
    header: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-400',
    accent: '#3b82f6',
    entityType: 'both',
    leadStatuses: ['contacted'],
    dealStages: [],
    description: 'Attempting to reach prospect',
    descriptionAr: 'محاولة الوصول إلى العميل المحتمل',
  },
  {
    key: 'key_person_reached',
    label: 'Key Person Reached',
    labelAr: 'تم التواصل مع المسؤول',
    color: 'border-indigo-200 bg-indigo-50',
    header: 'bg-indigo-100 text-indigo-700',
    dot: 'bg-indigo-400',
    accent: '#6366f1',
    entityType: 'both',
    leadStatuses: ['qualified'],
    dealStages: [],
    description: 'Decision maker engaged — convert to Prospect',
    descriptionAr: 'تم التواصل مع صاحب القرار — تحويل إلى عميل مؤهَّل',
  },
  {
    key: 'opportunity',
    label: 'Prospect',
    labelAr: 'عميل مؤهَّل',
    color: 'border-violet-200 bg-violet-50',
    header: 'bg-violet-100 text-violet-700',
    dot: 'bg-violet-500',
    accent: '#8b5cf6',
    entityType: 'deal',
    leadStatuses: [],
    dealStages: ['lead', 'contacted'],
    description: 'Qualified prospect — deal opened, defining needs',
    descriptionAr: 'عميل مؤهَّل — صفقة مفتوحة، تحديد الاحتياجات',
  },
  {
    key: 'follow_up',
    label: 'Follow Up',
    labelAr: 'متابعة',
    color: 'border-yellow-200 bg-yellow-50',
    header: 'bg-yellow-100 text-yellow-700',
    dot: 'bg-yellow-500',
    accent: '#f59e0b',
    entityType: 'deal',
    leadStatuses: [],
    dealStages: ['contacted'],
    description: 'Nurturing, follow-up scheduled',
    descriptionAr: 'رعاية العميل، متابعة مجدولة',
  },
  {
    key: 'rfq_requested',
    label: 'RFQ Requested',
    labelAr: 'طلب عرض سعر',
    color: 'border-orange-200 bg-orange-50',
    header: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
    accent: '#f97316',
    entityType: 'deal',
    leadStatuses: [],
    dealStages: ['rfq'],
    description: 'RFQ submitted to Operations',
    descriptionAr: 'طلب عرض السعر مُرسَل إلى العمليات',
  },
  {
    key: 'quoted',
    label: 'Quoted',
    labelAr: 'تم التسعير',
    color: 'border-cyan-200 bg-cyan-50',
    header: 'bg-cyan-100 text-cyan-700',
    dot: 'bg-cyan-500',
    accent: '#06b6d4',
    entityType: 'deal',
    leadStatuses: [],
    dealStages: ['quotation'],
    description: 'Quotation sent to client',
    descriptionAr: 'تم إرسال عرض السعر للعميل',
  },
  {
    key: 'negotiation',
    label: 'Negotiation',
    labelAr: 'تفاوض',
    color: 'border-pink-200 bg-pink-50',
    header: 'bg-pink-100 text-pink-700',
    dot: 'bg-pink-500',
    accent: '#ec4899',
    entityType: 'deal',
    leadStatuses: [],
    dealStages: ['negotiation'],
    description: 'Negotiating terms with client',
    descriptionAr: 'التفاوض على الشروط مع العميل',
  },
  {
    key: 'won',
    label: 'Won ✓',
    labelAr: 'مكسب',
    color: 'border-green-200 bg-green-50',
    header: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
    accent: '#22c55e',
    entityType: 'deal',
    leadStatuses: [],
    dealStages: ['won'],
    description: 'Deal closed — convert to customer',
    descriptionAr: 'الصفقة مغلقة — تحويل إلى عميل',
  },
  {
    key: 'lost',
    label: 'Lost',
    labelAr: 'خسارة',
    color: 'border-red-200 bg-red-50',
    header: 'bg-red-100 text-red-700',
    dot: 'bg-red-400',
    accent: '#ef4444',
    entityType: 'deal',
    leadStatuses: ['disqualified'],
    dealStages: ['lost'],
    description: 'Deal lost — reason recorded',
    descriptionAr: 'الصفقة خُسرت — تم تسجيل السبب',
  },
];

// Stage order for "next stage" navigation (excluding won/lost as they need modals)
const STAGE_ORDER = [
  'my_leads', 'contact_attempt', 'key_person_reached',
  'opportunity', 'follow_up', 'rfq_requested', 'quoted', 'negotiation',
];

function getNextStage(currentKey: string, itemType: 'lead' | 'deal'): string | null {
  const idx = STAGE_ORDER.indexOf(currentKey);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  const next = STAGE_ORDER[idx + 1];
  // Leads can only advance to key_person_reached max (after that must convert to deal)
  if (itemType === 'lead' && ['opportunity', 'follow_up', 'rfq_requested', 'quoted', 'negotiation'].includes(next)) {
    return null; // signal: convert to deal
  }
  return next;
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────
function dealStageToWorkspace(stage: string): string {
  if (stage === 'lead') return 'opportunity';
  if (stage === 'contacted') return 'opportunity';
  if (stage === 'rfq') return 'rfq_requested';
  if (stage === 'quotation') return 'quoted';
  if (stage === 'negotiation') return 'negotiation';
  if (stage === 'won') return 'won';
  if (stage === 'lost') return 'lost';
  return 'opportunity';
}

function leadStatusToWorkspace(status: string): string {
  if (status === 'new') return 'my_leads';
  if (status === 'contacted') return 'contact_attempt';
  if (status === 'qualified') return 'key_person_reached';
  if (status === 'disqualified') return 'lost';
  return 'my_leads';
}

function workspaceToDealStage(workspaceKey: string): string {
  const map: Record<string, string> = {
    opportunity: 'contacted',
    follow_up: 'contacted',
    rfq_requested: 'rfq',
    quoted: 'quotation',
    negotiation: 'negotiation',
    won: 'won',
    lost: 'lost',
  };
  return map[workspaceKey] || 'contacted';
}

function workspaceToLeadStatus(workspaceKey: string): string | null {
  const map: Record<string, string> = {
    my_leads: 'new',
    contact_attempt: 'contacted',
    key_person_reached: 'qualified',
    lost: 'disqualified',
  };
  return map[workspaceKey] || null;
}

function getStageLabel(key: string, isRTL: boolean): string {
  const stage = WORKSPACE_STAGES.find(s => s.key === key);
  if (!stage) return key;
  return isRTL ? stage.labelAr : stage.label;
}

// ─── Add Lead Modal ───────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onSuccess, userId }: {
  onClose: () => void; onSuccess: () => void; userId?: string;
}) {
  const { isRTL } = useI18n();
  const [form, setForm] = useState({
    company_name: '', contact_name: '', phone: '', email: '',
    source: 'manual', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.company_name.trim()) { setError(isRTL ? 'اسم الشركة مطلوب' : 'Company name is required'); return; }
    setSaving(true);
    try {
      await leadsAPI.create({ ...form, assigned_to: userId });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create lead');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            {isRTL ? 'إضافة عميل محتمل' : 'Add New Lead'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'اسم الشركة *' : 'Company Name *'}</label>
            <input value={form.company_name} onChange={e => f('company_name', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'اسم جهة الاتصال' : 'Contact Name'}</label>
              <input value={form.contact_name} onChange={e => f('contact_name', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'الهاتف' : 'Phone'}</label>
              <input value={form.phone} onChange={e => f('phone', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
            <input type="email" value={form.email} onChange={e => f('email', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <textarea rows={2} value={form.notes} onChange={e => f('notes', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'إضافة' : 'Add Lead')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Deal Modal ───────────────────────────────────────────────────────────
function AddDealModal({ onClose, onSuccess, customers, userId, convertLeadId }: {
  onClose: () => void; onSuccess: () => void;
  customers: any[]; userId?: string; convertLeadId?: string;
}) {
  const { isRTL } = useI18n();
  const [form, setForm] = useState({
    title: '', customer_id: '', value: '', currency: 'USD',
    shipping_mode: 'sea', origin_country: '', destination_country: '',
    service_type: '', probability: '30', expected_close_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError(isRTL ? 'عنوان الصفقة مطلوب' : 'Deal title is required'); return; }
    setSaving(true);
    try {
      await dealsAPI.create({
        title: form.title, customer_id: form.customer_id || undefined,
        value: parseFloat(form.value) || 0, currency: form.currency,
        shipping_mode: form.shipping_mode, origin_country: form.origin_country,
        destination_country: form.destination_country, service_type: form.service_type,
        probability: parseInt(form.probability) || 30,
        expected_close_date: form.expected_close_date || undefined,
        notes: form.notes, stage: 'contacted',
        lead_id: convertLeadId || undefined,
      });
      if (convertLeadId && leadsAPI) {
        try { await leadsAPI.update(convertLeadId, { status: 'disqualified', notes: 'Converted to deal' }); } catch {}
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to create deal');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-violet-600" />
            {convertLeadId ? (isRTL ? 'تحويل إلى صفقة' : 'Convert to Deal') : (isRTL ? 'إنشاء صفقة' : 'Create Deal')}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
          {convertLeadId && (
            <div className="bg-violet-50 text-violet-700 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <Zap className="w-4 h-4" />
              {isRTL ? 'يتم تحويل عميل محتمل إلى صفقة' : 'Converting lead to deal — key person has responded positively'}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'عنوان الصفقة *' : 'Deal Title *'}</label>
            <input value={form.title} onChange={e => f('title', e.target.value)}
              placeholder={isRTL ? 'مثال: شحن بضائع من دبي إلى القاهرة' : 'e.g. Freight Dubai → Cairo'}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'العميل' : 'Customer'}</label>
              <select value={form.customer_id} onChange={e => f('customer_id', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400">
                <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'نمط الشحن' : 'Shipping Mode'}</label>
              <select value={form.shipping_mode} onChange={e => f('shipping_mode', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400">
                <option value="sea">{isRTL ? 'شحن بحري' : 'Sea Freight'}</option>
                <option value="air">{isRTL ? 'شحن جوي' : 'Air Freight'}</option>
                <option value="road">{isRTL ? 'شحن بري' : 'Road Freight'}</option>
                <option value="rail">{isRTL ? 'شحن بالسكك' : 'Rail Freight'}</option>
                <option value="multimodal">{isRTL ? 'متعدد الوسائط' : 'Multimodal'}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'بلد المنشأ' : 'Origin Country'}</label>
              <input value={form.origin_country} onChange={e => f('origin_country', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'بلد الوجهة' : 'Destination Country'}</label>
              <input value={form.destination_country} onChange={e => f('destination_country', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'القيمة التقديرية' : 'Est. Value'}</label>
              <div className="flex gap-2">
                <select value={form.currency} onChange={e => f('currency', e.target.value)}
                  className="w-20 border border-gray-300 rounded-xl px-2 py-2 text-xs focus:ring-2 focus:ring-violet-400">
                  {['USD','EUR','GBP','AED','SAR','EGP'].map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="number" value={form.value} onChange={e => f('value', e.target.value)}
                  placeholder="0"
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'احتمالية الفوز %' : 'Win Probability %'}</label>
              <input type="number" min="0" max="100" value={form.probability} onChange={e => f('probability', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'تاريخ الإغلاق المتوقع' : 'Expected Close Date'}</label>
            <input type="date" value={form.expected_close_date} onChange={e => f('expected_close_date', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <textarea rows={2} value={form.notes} onChange={e => f('notes', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
            {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'إنشاء الصفقة' : 'Create Deal')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Won Action Modal ─────────────────────────────────────────────────────────
function WonActionModal({ deal, onClose, onSuccess }: {
  deal: any; onClose: () => void; onSuccess: () => void;
}) {
  const { isRTL } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<'confirm' | 'done'>('confirm');
  const [convertCustomer, setConvertCustomer] = useState(true);
  const [enableShipment, setEnableShipment] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleWon = async () => {
    setSaving(true);
    try {
      await dealsAPI.update(deal.id, { stage: 'won', probability: 100 });
      onSuccess();
      setStep('done');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (step === 'done') return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Award className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{isRTL ? 'تهانينا! الصفقة مكسبة' : 'Congratulations! Deal Won'}</h2>
        <p className="text-sm text-gray-500 mb-6">
          {isRTL ? 'تم تحديث مرحلة الصفقة إلى "مكسب". الخطوات التالية:' : 'Deal stage updated to Won. Next steps:'}
        </p>
        <div className="space-y-3 mb-6 text-start">
          {convertCustomer && (
            <button onClick={() => { onClose(); router.push(`/customers?dealId=${deal.id}`); }}
              className="w-full flex items-center gap-3 p-3 border border-green-200 rounded-xl hover:bg-green-50 transition-colors">
              <Users className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{isRTL ? 'تحويل إلى عميل' : 'Convert to Customer'}</p>
                <p className="text-xs text-gray-500">{isRTL ? 'إنشاء سجل عميل من هذه الصفقة' : 'Create a customer record from this deal'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 ms-auto" />
            </button>
          )}
          {enableShipment && (
            <button onClick={() => { onClose(); router.push(`/shipments?dealId=${deal.id}`); }}
              className="w-full flex items-center gap-3 p-3 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors">
              <Package className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{isRTL ? 'إنشاء شحنة' : 'Create Shipment'}</p>
                <p className="text-xs text-gray-500">{isRTL ? 'بدء تتبع الشحنة لهذه الصفقة' : 'Start shipment tracking for this deal'}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 ms-auto" />
            </button>
          )}
          <button onClick={() => { onClose(); router.push(`/deals/${deal.id}`); }}
            className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Eye className="w-5 h-5 text-gray-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">{isRTL ? 'عرض الصفقة' : 'View Deal'}</p>
              <p className="text-xs text-gray-500">{isRTL ? 'فتح تفاصيل الصفقة' : 'Open deal details'}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 ms-auto" />
          </button>
        </div>
        <button onClick={onClose}
          className="w-full px-5 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
          {isRTL ? 'إغلاق' : 'Close'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ThumbsUp className="w-5 h-5 text-green-600" />
            {isRTL ? 'إغلاق الصفقة — مكسب' : 'Close Deal — Won'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-800">{deal.title}</p>
            {deal.value > 0 && (
              <p className="text-sm text-green-700 font-bold mt-1 ltr-num">{deal.currency || 'USD'} {Number(deal.value).toLocaleString()}</p>
            )}
          </div>
          <p className="text-sm text-gray-600">
            {isRTL ? 'سيتم تحديث مرحلة الصفقة إلى "مكسب". هل تريد:' : 'Deal stage will be updated to Won. Do you want to:'}
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={convertCustomer} onChange={e => setConvertCustomer(e.target.checked)} className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">{isRTL ? 'تحويل إلى عميل' : 'Convert to Customer'}</p>
                <p className="text-xs text-gray-500">{isRTL ? 'إضافة العميل إلى قاعدة بيانات العملاء' : 'Add to customers database'}</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={enableShipment} onChange={e => setEnableShipment(e.target.checked)} className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">{isRTL ? 'تفعيل إنشاء شحنة' : 'Enable Shipment Creation'}</p>
                <p className="text-xs text-gray-500">{isRTL ? 'تحضير شحنة مرتبطة بالصفقة' : 'Prepare a shipment linked to this deal'}</p>
              </div>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleWon} disabled={saving}
            className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
            <Award className="w-4 h-4" />
            {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'تأكيد الفوز' : 'Confirm Won')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lost Action Modal ────────────────────────────────────────────────────────
function LostActionModal({ deal, onClose, onSuccess }: {
  deal: any; onClose: () => void; onSuccess: () => void;
}) {
  const { isRTL } = useI18n();
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const LOSS_REASONS = [
    'Price too high', 'Competitor selected', 'No budget', 'No response', 'Timeline mismatch', 'Other',
  ];

  const handleLost = async () => {
    const finalReason = reason === 'Other' ? customReason : reason;
    if (!finalReason.trim()) { setError(isRTL ? 'سبب الخسارة مطلوب' : 'Loss reason is required'); return; }
    setSaving(true);
    try {
      await dealsAPI.update(deal.id, { stage: 'lost', loss_reason: finalReason, probability: 0 });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to update deal');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            {isRTL ? 'إغلاق الصفقة — خسارة' : 'Close Deal — Lost'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-red-800">{deal.title}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">{isRTL ? 'سبب الخسارة *' : 'Loss Reason *'}</label>
            <div className="grid grid-cols-2 gap-2">
              {LOSS_REASONS.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={`px-3 py-2 text-xs rounded-xl border transition-all ${
                    reason === r ? 'border-red-400 bg-red-50 text-red-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {reason === 'Other' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{isRTL ? 'سبب آخر' : 'Specify reason'}</label>
              <input value={customReason} onChange={e => setCustomReason(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-400" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleLost} disabled={saving}
            className="px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'تأكيد الخسارة' : 'Mark as Lost')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card Component ────────────────────────────────────────────────────────────
function WorkspaceCard({
  item, type, stageKey, onRFQ, onConvertToDeal, onWon, onLost, canManage,
  onAdvanceStage, onUndoRequest,
}: {
  item: any; type: 'lead' | 'deal'; stageKey: string;
  onRFQ?: () => void; onConvertToDeal?: () => void;
  onWon?: () => void; onLost?: () => void; canManage?: boolean;
  onAdvanceStage?: () => void; // arrow button → next stage
  onUndoRequest?: () => void; // undo last move (from card)
}) {
  const { isRTL } = useI18n();
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isLead = type === 'lead';
  const fmt = (n: number) => n?.toLocaleString('en-US', { minimumFractionDigits: 0 }) || '0';

  // Compute next stage for arrow button
  const nextStage = canManage ? getNextStage(stageKey, type) : null;
  // Lead at key_person_reached: next action is convert to deal
  const nextIsConvert = canManage && isLead && stageKey === 'key_person_reached';
  // Lead at contact_attempt: can convert too
  const showConvertButton = isLead && ['contact_attempt', 'key_person_reached'].includes(stageKey) && canManage;
  // Show forward arrow: for deals that have a defined next stage, or leads with an ordinary next
  const showForwardArrow = canManage && !isLead && nextStage !== null && !['won','lost'].includes(stageKey);
  // For deals at negotiation, next is "Won" → show Won button
  const showWonButton = !isLead && stageKey === 'negotiation' && canManage;
  const showLostButton = !isLead && !['won', 'lost'].includes(stageKey) && canManage;
  const showRFQButton = !isLead && ['opportunity', 'follow_up', 'rfq_requested'].includes(stageKey) && canManage;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.setData('itemType', type);
    e.dataTransfer.setData('currentStage', stageKey);
    setDragging(true);
  };

  // ── Touch drag (mobile) ─────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canManage) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) return;
    const touch = e.touches[0];
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.id = 'touch-drag-ghost';
    ghost.style.cssText = `
      position:fixed; z-index:9999; pointer-events:none; opacity:0.88;
      width:${rect.width}px; top:${touch.clientY - 20}px; left:${touch.clientX - rect.width / 2}px;
      box-shadow:0 10px 36px rgba(0,0,0,0.28); border-radius:14px; transform:scale(1.06);
      transition:none;
    `;
    document.body.appendChild(ghost);
    startTouchDrag({ itemId: item.id, itemType: type, currentStage: stageKey, ghostEl: ghost });
    setDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const drag = getTouchDrag();
    if (!drag?.ghostEl) return;
    e.preventDefault();
    const touch = e.touches[0];
    const ghostW = drag.ghostEl.offsetWidth;
    drag.ghostEl.style.top  = `${touch.clientY - 20}px`;
    drag.ghostEl.style.left = `${touch.clientX - ghostW / 2}px`;
    drag.ghostEl.style.display = 'none';
    const els = document.elementsFromPoint(touch.clientX, touch.clientY);
    drag.ghostEl.style.display = '';
    document.querySelectorAll('[data-stage-key]').forEach(col => {
      col.classList.remove('ring-2', 'ring-violet-400', 'ring-inset');
    });
    for (const el of els) {
      let cur: HTMLElement | null = el as HTMLElement;
      while (cur) {
        if (cur.dataset?.stageKey) { cur.classList.add('ring-2', 'ring-violet-400', 'ring-inset'); break; }
        cur = cur.parentElement;
      }
      if ((el as HTMLElement).dataset?.stageKey) break;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const drag = getTouchDrag();
    setDragging(false);
    if (!drag) return;
    if (drag.ghostEl) drag.ghostEl.style.display = 'none';
    const touch = e.changedTouches[0];
    const els = document.elementsFromPoint(touch.clientX, touch.clientY);
    document.querySelectorAll('[data-stage-key]').forEach(col => {
      col.classList.remove('ring-2', 'ring-violet-400', 'ring-inset');
    });
    drag.ghostEl?.remove();
    let targetStageKey: string | null = null;
    for (const el of els) {
      let cur: HTMLElement | null = el as HTMLElement;
      while (cur) {
        if (cur.dataset?.stageKey) { targetStageKey = cur.dataset.stageKey; break; }
        cur = cur.parentElement;
      }
      if (targetStageKey) break;
    }
    endTouchDrag();
    if (targetStageKey) {
      window.dispatchEvent(new CustomEvent('workspace-touch-drop', {
        detail: { itemId: drag.itemId, itemType: drag.itemType, currentStage: drag.currentStage, newStageKey: targetStageKey },
      }));
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <div
      draggable={canManage}
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      onTouchStart={canManage ? handleTouchStart : undefined}
      onTouchMove={canManage ? handleTouchMove : undefined}
      onTouchEnd={canManage ? handleTouchEnd : undefined}
      style={{ touchAction: canManage ? 'none' : undefined }}
      className={`bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition-all select-none ${
        canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      } ${dragging ? 'opacity-50 scale-95' : 'hover:border-violet-300'}`}
    >
      {/* Top: name + type badge + menu */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 mb-1 flex-wrap">
            {isLead ? (
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">LEAD</span>
            ) : (
              <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0">DEAL</span>
            )}
            {item.deal_number && <span className="text-xs text-gray-400 font-mono truncate">{item.deal_number}</span>}
            {item.rfq_number && !isLead && <span className="text-xs text-orange-500 font-mono truncate">{item.rfq_number}</span>}
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-snug break-words" style={{wordBreak:'break-word',overflowWrap:'anywhere'}}>{item.title || item.company_name}</p>
        </div>
        <div className="relative flex-shrink-0 flex items-center gap-1" ref={menuRef}>
          {/* ── Forward Arrow Button (primary CTA) ── */}
          {showForwardArrow && onAdvanceStage && (
            <button
              onClick={onAdvanceStage}
              title={isRTL ? 'تقدم للمرحلة التالية' : 'Advance to next stage'}
              className="p-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowRightCircle className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setShowMenu(v => !v)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <MoreHorizontal className="w-4 h-4 text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute end-0 top-6 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
              <button onClick={() => { router.push(isLead ? `/sales/my-leads` : `/deals/${item.id}`); setShowMenu(false); }}
                className="w-full text-start px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5" /> {isRTL ? 'عرض' : 'View Details'}
              </button>
              {!isLead && canManage && (
                <button onClick={() => { router.push(`/rfqs?dealId=${item.id}`); setShowMenu(false); }}
                  className="w-full text-start px-3 py-2 text-xs hover:bg-gray-50 text-gray-700 flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" /> {isRTL ? 'فتح الصفقة' : 'Open Deal Page'}
                </button>
              )}
              {!isLead && canManage && onRFQ && (
                <button onClick={() => { onRFQ(); setShowMenu(false); }}
                  className="w-full text-start px-3 py-2 text-xs hover:bg-violet-50 text-violet-700 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> {isRTL ? 'تقديم طلب سعر' : 'Submit RFQ'}
                </button>
              )}
              {showForwardArrow && onAdvanceStage && (
                <button onClick={() => { onAdvanceStage(); setShowMenu(false); }}
                  className="w-full text-start px-3 py-2 text-xs hover:bg-violet-50 text-violet-700 flex items-center gap-2">
                  <ArrowRightCircle className="w-3.5 h-3.5" /> {isRTL ? 'المرحلة التالية' : 'Next Stage'}
                </button>
              )}
              {showWonButton && onWon && (
                <button onClick={() => { onWon(); setShowMenu(false); }}
                  className="w-full text-start px-3 py-2 text-xs hover:bg-green-50 text-green-700 flex items-center gap-2">
                  <ThumbsUp className="w-3.5 h-3.5" /> {isRTL ? 'تأكيد الفوز' : 'Mark as Won'}
                </button>
              )}
              {showLostButton && onLost && (
                <button onClick={() => { onLost(); setShowMenu(false); }}
                  className="w-full text-start px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5" /> {isRTL ? 'تأكيد الخسارة' : 'Mark as Lost'}
                </button>
              )}
              {onUndoRequest && (
                <button onClick={() => { onUndoRequest(); setShowMenu(false); }}
                  className="w-full text-start px-3 py-2 text-xs hover:bg-orange-50 text-orange-600 flex items-center gap-2 border-t border-gray-100 mt-1">
                  <RotateCcw className="w-3.5 h-3.5" /> {isRTL ? 'تراجع عن الآخر' : 'Undo Last Move'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Customer / Company */}
      {(item.customer_name || item.company_name) && (
        <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-1.5">
          <Building2 className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
          <span className="break-words" style={{wordBreak:'break-word'}}>{item.customer_name || item.company_name}</span>
        </div>
      )}

      {/* Contact for leads */}
      {isLead && item.contact_name && (
        <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-1">
          <User className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" />
          <span className="break-words" style={{wordBreak:'break-word'}}>{item.contact_name}{item.phone ? <span className="text-gray-400"> · {item.phone}</span> : null}</span>
        </div>
      )}

      {/* Route for deals */}
      {!isLead && (item.origin_country || item.destination_country) && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1.5">
          <Globe className="w-3 h-3" />
          <span>{item.origin_country}</span>
          {item.origin_country && item.destination_country && <ArrowRight className="w-2.5 h-2.5" />}
          <span>{item.destination_country}</span>
        </div>
      )}

      {/* Value for deals */}
      {!isLead && item.value > 0 && (
        <div className="flex items-center gap-1 text-xs font-semibold text-green-700 mb-1.5">
          <DollarSign className="w-3 h-3" />
          <span className="ltr-num">{item.currency || 'USD'} {fmt(Number(item.value))}</span>
          {item.probability > 0 && <span className="text-gray-400 font-normal">({item.probability}%)</span>}
        </div>
      )}

      {/* Expected close date */}
      {!isLead && item.expected_close_date && (
        <div className="text-xs text-gray-400 flex items-center gap-1 mb-1.5">
          <Calendar className="w-3 h-3" />
          {new Date(item.expected_close_date).toLocaleDateString()}
        </div>
      )}

      {/* Action buttons area */}
      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
        {/* Convert to Deal button for leads */}
        {showConvertButton && onConvertToDeal && (
          <button onClick={onConvertToDeal}
            className="w-full text-xs text-violet-600 hover:bg-violet-50 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-violet-200 font-semibold">
            <Zap className="w-3 h-3" />
            {isRTL ? 'تحويل إلى صفقة' : 'Convert to Deal'}
          </button>
        )}

        {/* Forward arrow for deals */}
        {showForwardArrow && onAdvanceStage && (
          <button onClick={onAdvanceStage}
            className="w-full text-xs text-violet-600 hover:bg-violet-50 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-violet-200 font-semibold">
            <ArrowRightCircle className="w-3 h-3" />
            {isRTL ? 'المرحلة التالية ←' : 'Advance → Next Stage'}
          </button>
        )}

        {/* Won button */}
        {showWonButton && onWon && (
          <button onClick={onWon}
            className="w-full text-xs text-green-700 hover:bg-green-50 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-green-200 font-semibold">
            <ThumbsUp className="w-3 h-3" />
            {isRTL ? 'تأكيد الفوز 🎉' : 'Mark as Won 🎉'}
          </button>
        )}

        {/* RFQ button */}
        {showRFQButton && onRFQ && (
          <button onClick={onRFQ}
            className="w-full text-xs text-orange-600 hover:bg-orange-50 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-orange-200 font-semibold">
            <FileText className="w-3 h-3" />
            {isRTL ? 'تقديم طلب عرض سعر' : 'Create RFQ'}
          </button>
        )}

        {!isLead && stageKey === 'rfq_requested' && (
          <button onClick={() => router.push(`/quotations?rfqDealId=${item.id}`)}
            className="w-full text-xs text-cyan-600 hover:bg-cyan-50 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-cyan-200 font-semibold">
            <Eye className="w-3 h-3" />
            {isRTL ? 'عرض الاقتباسات' : 'View Quotations'}
          </button>
        )}

        {!isLead && stageKey === 'won' && (
          <div className="flex gap-1">
            <button onClick={() => router.push(`/shipments?dealId=${item.id}`)}
              className="flex-1 text-xs text-green-600 hover:bg-green-50 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-green-200 font-semibold">
              <Package className="w-3 h-3" />
              {isRTL ? 'شحنة' : 'Shipment'}
            </button>
            <button onClick={() => router.push(`/customers?dealId=${item.id}`)}
              className="flex-1 text-xs text-emerald-600 hover:bg-emerald-50 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-emerald-200 font-semibold">
              <Users className="w-3 h-3" />
              {isRTL ? 'عميل' : 'Customer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stage Column ─────────────────────────────────────────────────────────────
function StageColumn({
  stage, items, onDrop, onRFQ, onConvertToDeal, onWon, onLost, canManage,
  onAdvanceStage, onUndoRequest,
}: {
  stage: typeof WORKSPACE_STAGES[0];
  items: any[];
  onDrop: (itemId: string, itemType: string, currentStage: string, newStageKey: string) => void;
  onRFQ: (dealId: string) => void;
  onConvertToDeal: (leadId: string) => void;
  onWon: (deal: any) => void;
  onLost: (deal: any) => void;
  canManage: boolean;
  onAdvanceStage: (itemId: string, itemType: string, currentStage: string) => void;
  onUndoRequest: () => void;
}) {
  const { isRTL } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);
  const totalValue = items.filter(i => i._type === 'deal').reduce((s, i) => s + Number(i.value || 0), 0);
  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

  return (
    <div
      data-stage-key={stage.key}
      className={`flex flex-col min-w-[230px] w-[230px] rounded-2xl border-2 transition-all ${
        isDragOver ? 'border-violet-400 bg-violet-50/50 scale-[1.01]' : stage.color
      }`}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setIsDragOver(false);
        const itemId = e.dataTransfer.getData('itemId');
        const itemType = e.dataTransfer.getData('itemType');
        const currentStage = e.dataTransfer.getData('currentStage');
        if (itemId && itemType) onDrop(itemId, itemType, currentStage, stage.key);
      }}
    >
      {/* Column Header */}
      <div className={`px-3 py-2.5 rounded-t-xl ${stage.header}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dot}`} />
            <span className="text-xs font-bold truncate">{isRTL ? stage.labelAr : stage.label}</span>
          </div>
          <span className="text-xs font-bold bg-white/60 px-1.5 py-0.5 rounded-full flex-shrink-0 ms-1">{items.length}</span>
        </div>
        {totalValue > 0 && (
          <div className="text-xs mt-0.5 opacity-70 font-medium ltr-num">{fmt(totalValue)}</div>
        )}
        <p className="text-xs opacity-60 mt-0.5 leading-tight line-clamp-2">{isRTL ? stage.descriptionAr : stage.description}</p>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[62vh]">
        {items.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            <div className="text-lg mb-1">↓</div>
            {isRTL ? 'اسحب هنا أو استخدم سهم التقدم' : 'Drop here or use advance arrow'}
          </div>
        ) : (
          items.map(item => (
            <WorkspaceCard
              key={`${item._type}-${item.id}`}
              item={item}
              type={item._type}
              stageKey={stage.key}
              onRFQ={item._type === 'deal' ? () => onRFQ(item.id) : undefined}
              onConvertToDeal={item._type === 'lead' ? () => onConvertToDeal(item.id) : undefined}
              onWon={item._type === 'deal' ? () => onWon(item) : undefined}
              onLost={item._type === 'deal' ? () => onLost(item) : undefined}
              canManage={canManage}
              onAdvanceStage={item._type === 'deal' ? () => onAdvanceStage(item.id, item._type, stage.key) : undefined}
              onUndoRequest={onUndoRequest}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Workspace Page ──────────────────────────────────────────────────────
function SalesWorkspaceContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isRTL } = useI18n();

  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'undo'; onUndo?: () => void } | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [hiddenStages, setHiddenStages] = useState<string[]>(['won', 'lost']);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [convertLeadId, setConvertLeadId] = useState<string | undefined>();
  const [wonDeal, setWonDeal] = useState<any>(null);
  const [lostDeal, setLostDeal] = useState<any>(null);
  // Undo history (last 10 moves)
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const role = user?.role || '';
  const isSales = role === 'Sales';
  const isAdmin = role === 'Admin';
  const isOps = role === 'Operations';
  const canManage = isSales || isAdmin;
  const canView = canManage || isOps;

  const showToast = (
    msg: string,
    type: 'success' | 'error' | 'undo' = 'success',
    onUndo?: () => void,
    duration = 4000
  ) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type, onUndo });
    toastTimerRef.current = setTimeout(() => setToast(null), duration);
  };

  const pushHistory = (entry: HistoryEntry) => {
    setHistory(prev => [entry, ...prev].slice(0, 10));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, dealsRes, customersRes] = await Promise.all([
        leadsAPI ? leadsAPI.getAll({ limit: 500 }).catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        dealsAPI.getAll({ limit: 500 }),
        customersAPI.getAll({ limit: 200 }).catch(() => ({ data: { data: [] } })),
      ]);

      const rawLeads = (leadsRes.data?.data || [])
        .filter((l: any) => isSales ? (l.assigned_to === user?.id || l.created_by === user?.id) : true)
        .filter((l: any) => l.status !== 'disqualified');

      const rawDeals = (dealsRes.data?.data || [])
        .filter((d: any) => isSales ? (d.assigned_to === user?.id || d.created_by === user?.id) : true);

      setLeads(rawLeads.map((l: any) => ({ ...l, _type: 'lead' })));
      setDeals(rawDeals.map((d: any) => ({ ...d, _type: 'deal' })));
      setCustomers(customersRes.data?.data || customersRes.data || []);
    } catch (e) {
      console.error('Workspace fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, isSales]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { itemId, itemType, currentStage, newStageKey } = (e as CustomEvent).detail;
      handleDrop(itemId, itemType, currentStage, newStageKey);
    };
    window.addEventListener('workspace-touch-drop', handler);
    return () => window.removeEventListener('workspace-touch-drop', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, leads, canManage, isRTL]);

  useEffect(() => {
    const leadId = searchParams?.get('convertLeadId');
    if (leadId) {
      setConvertLeadId(leadId);
      setShowAddDeal(true);
    }
  }, [searchParams]);

  // ─── Place items into stages ────────────────────────────────────────────────
  const stageItems: Record<string, any[]> = {};
  WORKSPACE_STAGES.forEach(s => { stageItems[s.key] = []; });

  const searchLower = search.toLowerCase();
  const filteredItems = [...leads, ...deals].filter(item => {
    if (!search) return true;
    const name = (item.title || item.company_name || '').toLowerCase();
    const customer = (item.customer_name || '').toLowerCase();
    const contact = (item.contact_name || '').toLowerCase();
    return name.includes(searchLower) || customer.includes(searchLower) || contact.includes(searchLower);
  });

  filteredItems.forEach(item => {
    let stageKey: string;
    if (item._type === 'lead') {
      stageKey = leadStatusToWorkspace(item.status);
    } else {
      stageKey = dealStageToWorkspace(item.stage);
    }
    if (stageItems[stageKey]) stageItems[stageKey].push(item);
    else stageItems['opportunity'].push(item);
  });

  // ─── Undo last history entry ────────────────────────────────────────────────
  const undoLastMove = useCallback(async () => {
    if (history.length === 0) {
      showToast(isRTL ? 'لا يوجد شيء للتراجع عنه' : 'Nothing to undo', 'error');
      return;
    }
    const entry = history[0];
    setHistory(prev => prev.slice(1));
    try {
      if (entry.itemType === 'deal') {
        await dealsAPI.update(entry.itemId, entry.previousValue as any);
        showToast(
          isRTL
            ? `تم التراجع: ${entry.itemName} → ${getStageLabel(entry.fromStage, isRTL)}`
            : `Undone: ${entry.itemName} → ${getStageLabel(entry.fromStage, false)}`,
          'success'
        );
      } else if (entry.itemType === 'lead' && leadsAPI) {
        await leadsAPI.update(entry.itemId, entry.previousValue as any);
        showToast(
          isRTL
            ? `تم التراجع: ${entry.itemName} → ${getStageLabel(entry.fromStage, isRTL)}`
            : `Undone: ${entry.itemName} → ${getStageLabel(entry.fromStage, false)}`,
          'success'
        );
      }
      await fetchData();
    } catch (e) {
      showToast(isRTL ? 'فشل التراجع' : 'Failed to undo', 'error');
    }
  }, [history, isRTL, fetchData]);

  // ─── Drag & Drop / Advance handler ─────────────────────────────────────────
  const handleDrop = async (itemId: string, itemType: string, currentStage: string, newStageKey: string) => {
    if (!canManage) return;
    if (currentStage === newStageKey) return;

    if (itemType === 'lead' && ['opportunity', 'rfq_requested', 'quoted', 'negotiation', 'won'].includes(newStageKey)) {
      if (newStageKey === 'opportunity') {
        setConvertLeadId(itemId); setShowAddDeal(true); return;
      }
      showToast(isRTL ? 'حوّل العميل المحتمل إلى صفقة أولاً' : 'Convert lead to deal first', 'error');
      return;
    }

    if (itemType === 'deal' && newStageKey === 'won') {
      const deal = deals.find(d => d.id === itemId);
      if (deal) { setWonDeal(deal); return; }
    }
    if (itemType === 'deal' && newStageKey === 'lost') {
      const deal = deals.find(d => d.id === itemId);
      if (deal) { setLostDeal(deal); return; }
    }

    try {
      if (itemType === 'deal') {
        const deal = deals.find(d => d.id === itemId);
        const newDealStage = workspaceToDealStage(newStageKey);
        // Record history for undo
        if (deal) {
          pushHistory({
            id: `${Date.now()}`,
            itemId,
            itemType: 'deal',
            itemName: deal.title || deal.company_name || itemId,
            fromStage: currentStage,
            toStage: newStageKey,
            previousValue: { stage: deal.stage },
            timestamp: Date.now(),
          });
        }
        await dealsAPI.update(itemId, { stage: newDealStage });
        const toLabel = getStageLabel(newStageKey, isRTL);
        showToast(
          isRTL ? `تم نقل الصفقة إلى "${toLabel}"` : `Deal moved to "${toLabel}"`,
          'undo',
          undoLastMove
        );
      } else if (itemType === 'lead') {
        const lead = leads.find(l => l.id === itemId);
        const newStatus = workspaceToLeadStatus(newStageKey);
        if (newStatus && leadsAPI) {
          if (lead) {
            pushHistory({
              id: `${Date.now()}`,
              itemId,
              itemType: 'lead',
              itemName: lead.company_name || itemId,
              fromStage: currentStage,
              toStage: newStageKey,
              previousValue: { status: lead.status },
              timestamp: Date.now(),
            });
          }
          await leadsAPI.update(itemId, { status: newStatus });
          const toLabel = getStageLabel(newStageKey, isRTL);
          showToast(
            isRTL ? `تم نقل العميل المحتمل إلى "${toLabel}"` : `Lead moved to "${toLabel}"`,
            'undo',
            undoLastMove
          );
        }
      }
      await fetchData();
    } catch (e) {
      showToast(isRTL ? 'فشل النقل' : 'Failed to move item', 'error');
    }
  };

  // ─── Advance to next stage (arrow button) ──────────────────────────────────
  const handleAdvanceStage = async (itemId: string, itemType: string, currentStage: string) => {
    const nextKey = getNextStage(currentStage, itemType as 'lead' | 'deal');
    if (!nextKey) return;
    await handleDrop(itemId, itemType, currentStage, nextKey);
  };

  const handleRFQFromDeal = (dealId: string) => {
    router.push(`/rfqs?dealId=${dealId}&new=1`);
  };

  const handleConvertToDeal = (leadId: string) => {
    setConvertLeadId(leadId);
    setShowAddDeal(true);
  };

  // ─── Metrics ────────────────────────────────────────────────────────────────
  const activeDeals = deals.filter(d => !['won', 'lost'].includes(d.stage));
  const totalLeads = leads.length;
  const wonDeals = deals.filter(d => d.stage === 'won').length;
  const pipeline = activeDeals.reduce((s, d) => s + Number(d.value || 0), 0);
  const rfqStageDeals = deals.filter(d => d.stage === 'rfq').length;
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

  const visibleStages = WORKSPACE_STAGES.filter(s => !hiddenStages.includes(s.key));
  const toggleStage = (key: string) => setHiddenStages(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]" dir={isRTL ? 'rtl' : 'ltr'}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="px-4 md:px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-600" />
                {isRTL ? 'خط أنابيب المبيعات' : 'Sales Pipeline'}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {isRTL
                  ? 'من العميل المحتمل إلى الصفقة المكسبة — نقطة دخول موحدة'
                  : 'From lead to won deal — use the → button to advance or drag cards between stages'}
              </p>
            </div>

            {/* KPIs */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Target className="w-4 h-4 text-slate-500" />
                <span className="text-xs text-slate-600">{isRTL ? 'عملاء محتملون:' : 'Leads:'}</span>
                <span className="text-sm font-bold text-slate-800 ltr-num">{totalLeads}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                <Briefcase className="w-4 h-4 text-violet-500" />
                <span className="text-xs text-violet-600">{isRTL ? 'صفقات نشطة:' : 'Active:'}</span>
                <span className="text-sm font-bold text-violet-800 ltr-num">{activeDeals.length}</span>
              </div>
              {rfqStageDeals > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                  <FileText className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-orange-600">{isRTL ? 'طلبات سعر:' : 'RFQs:'}</span>
                  <span className="text-sm font-bold text-orange-800 ltr-num">{rfqStageDeals}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <Award className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-600">{isRTL ? 'مكسب:' : 'Won:'}</span>
                <span className="text-sm font-bold text-green-800 ltr-num">{wonDeals}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                <DollarSign className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-blue-600">{isRTL ? 'خط الأنابيب:' : 'Pipeline:'}</span>
                <span className="text-sm font-bold text-blue-800 ltr-num">{fmt(pipeline)}</span>
              </div>
              {/* Undo button in header */}
              {history.length > 0 && canManage && (
                <button
                  onClick={undoLastMove}
                  title={isRTL ? 'تراجع عن آخر خطوة' : 'Undo last move'}
                  className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 hover:bg-orange-100 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-orange-600" />
                  <span className="text-xs text-orange-700 font-semibold">{isRTL ? 'تراجع' : 'Undo'}</span>
                  <span className="text-xs bg-orange-200 text-orange-700 px-1 rounded-full font-bold">{history.length}</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder={isRTL ? 'بحث...' : 'Search leads & deals...'}
                className="w-full ps-9 pe-4 py-2 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute end-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 rounded">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
              <button onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
                {isRTL ? 'كانبان' : 'Kanban'}
              </button>
              <button onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
                {isRTL ? 'قائمة' : 'List'}
              </button>
            </div>

            {/* Stage visibility toggles */}
            <div className="flex gap-1">
              {(['won', 'lost'] as const).map(key => {
                const stage = WORKSPACE_STAGES.find(s => s.key === key)!;
                const hidden = hiddenStages.includes(key);
                return (
                  <button key={key} onClick={() => toggleStage(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
                      !hidden
                        ? (key === 'won' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-400 bg-red-50 text-red-700')
                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}>
                    {hidden ? '＋ ' : '－ '}{isRTL ? stage.labelAr : stage.label}
                  </button>
                );
              })}
            </div>

            <button onClick={fetchData}
              className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors" title={isRTL ? 'تحديث' : 'Refresh'}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Add buttons */}
            {canManage && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAddLead(true)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors">
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'عميل محتمل' : 'Add Lead'}
                </button>
                <button onClick={() => { setConvertLeadId(undefined); setShowAddDeal(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'صفقة جديدة' : 'New Deal'}
                </button>
              </div>
            )}
          </div>

          {/* ── Role info banner for Ops ─────────────────────────────────────── */}
          {isOps && !canManage && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700">
                {isRTL
                  ? 'أنت تعرض خط أنابيب المبيعات بصلاحيات القراءة فقط.'
                  : 'You are viewing the sales pipeline in read-only mode. You can upload quotations from the RFQs page.'}
              </p>
            </div>
          )}

          {/* ── Undo hint banner ─────────────────────────────────────────────── */}
          {history.length > 0 && canManage && (
            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <p className="text-xs text-orange-700">
                  {isRTL
                    ? `يوجد ${history.length} خطوة قابلة للتراجع`
                    : `${history.length} move${history.length > 1 ? 's' : ''} in undo history — last: "${history[0]?.itemName}" → ${getStageLabel(history[0]?.toStage, isRTL)}`}
                </p>
              </div>
              <button
                onClick={undoLastMove}
                className="flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-900 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isRTL ? 'تراجع' : 'Undo'}
              </button>
            </div>
          )}
        </div>

        {/* ── Board / List ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center flex-1 gap-3">
            <RefreshCw className="w-6 h-6 text-violet-500 animate-spin" />
            <span className="text-sm text-gray-500">{isRTL ? 'جاري التحميل...' : 'Loading pipeline...'}</span>
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 p-4 h-full" style={{ minWidth: `${visibleStages.length * 248}px` }}>
              {visibleStages.map(stage => (
                <StageColumn
                  key={stage.key}
                  stage={stage}
                  items={stageItems[stage.key] || []}
                  onDrop={handleDrop}
                  onRFQ={handleRFQFromDeal}
                  onConvertToDeal={handleConvertToDeal}
                  onWon={(deal) => setWonDeal(deal)}
                  onLost={(deal) => setLostDeal(deal)}
                  canManage={canManage}
                  onAdvanceStage={handleAdvanceStage}
                  onUndoRequest={undoLastMove}
                />
              ))}
            </div>
          </div>
        ) : (
          // List View
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-5xl mx-auto space-y-3">
              {visibleStages.map(stage => {
                const items = stageItems[stage.key] || [];
                if (items.length === 0) return null;
                return (
                  <div key={stage.key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className={`px-4 py-3 flex items-center justify-between ${stage.header}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                        <span className="text-sm font-bold">{isRTL ? stage.labelAr : stage.label}</span>
                        <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full">{items.length}</span>
                      </div>
                      <span className="text-xs text-gray-500 hidden sm:block">{isRTL ? stage.descriptionAr : stage.description}</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {items.map(item => (
                        <div key={`${item._type}-${item.id}`} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${item._type === 'lead' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'}`}>
                              {item._type === 'lead' ? 'L' : 'D'}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.title || item.company_name}</p>
                              {(item.customer_name || item.contact_name) && (
                                <p className="text-xs text-gray-500 truncate">{item.customer_name || item.contact_name}</p>
                              )}
                            </div>
                          </div>
                          {item._type === 'deal' && item.value > 0 && (
                            <span className="text-sm font-bold text-green-700 ltr-num flex-shrink-0">
                              {item.currency || 'USD'} {Number(item.value).toLocaleString()}
                            </span>
                          )}
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => router.push(item._type === 'lead' ? '/sales/my-leads' : `/deals/${item.id}`)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="View">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {item._type === 'deal' && canManage && (
                              <>
                                {/* Advance arrow for list view */}
                                {!['won','lost','negotiation'].includes(stage.key) && getNextStage(stage.key, 'deal') && (
                                  <button
                                    onClick={() => handleAdvanceStage(item.id, item._type, stage.key)}
                                    className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg"
                                    title={isRTL ? 'المرحلة التالية' : 'Next Stage'}
                                  >
                                    <ArrowRightCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button onClick={() => handleRFQFromDeal(item.id)}
                                  className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg" title="Create RFQ">
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                {stage.key === 'negotiation' && (
                                  <button onClick={() => setWonDeal(item)}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Mark Won">
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                            {item._type === 'lead' && canManage && ['contact_attempt', 'key_person_reached'].includes(stage.key) && (
                              <button onClick={() => handleConvertToDeal(item.id)}
                                className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg" title="Convert to Deal">
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {/* Lead advance arrow in list */}
                            {item._type === 'lead' && canManage && getNextStage(stage.key, 'lead') && (
                              <button
                                onClick={() => handleAdvanceStage(item.id, item._type, stage.key)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                title={isRTL ? 'المرحلة التالية' : 'Next Stage'}
                              >
                                <ArrowRightCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {visibleStages.every(s => (stageItems[s.key] || []).length === 0) && (
                <div className="text-center py-16 text-gray-400">
                  <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">{isRTL ? 'لا توجد عناصر في خط الأنابيب' : 'Pipeline is empty'}</p>
                  {canManage && (
                    <p className="text-xs mt-1">{isRTL ? 'أضف عميلاً محتملاً أو صفقة للبدء' : 'Add a lead or deal to get started'}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Toast ───────────────────────────────────────────────────────────── */}
        {toast && (
          <div className={`fixed bottom-4 end-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50 transition-all max-w-xs ${
            toast.type === 'error' ? 'bg-red-600' : toast.type === 'undo' ? 'bg-gray-800' : 'bg-green-600'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> :
             toast.type === 'undo' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> :
             <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
            <span className="flex-1">{toast.msg}</span>
            {toast.type === 'undo' && toast.onUndo && (
              <button
                onClick={() => { toast.onUndo?.(); setToast(null); }}
                className="flex items-center gap-1 text-xs font-bold text-orange-300 hover:text-orange-200 whitespace-nowrap border-l border-white/20 pl-3 ml-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isRTL ? 'تراجع' : 'Undo'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      {showAddLead && (
        <AddLeadModal
          userId={user?.id}
          onClose={() => setShowAddLead(false)}
          onSuccess={() => { fetchData(); showToast(isRTL ? 'تم إضافة العميل المحتمل' : 'Lead added successfully'); }}
        />
      )}

      {showAddDeal && (
        <AddDealModal
          customers={customers}
          userId={user?.id}
          convertLeadId={convertLeadId}
          onClose={() => { setShowAddDeal(false); setConvertLeadId(undefined); }}
          onSuccess={() => { fetchData(); showToast(isRTL ? 'تم إنشاء الصفقة' : 'Deal created successfully'); }}
        />
      )}

      {wonDeal && (
        <WonActionModal
          deal={wonDeal}
          onClose={() => setWonDeal(null)}
          onSuccess={() => { fetchData(); showToast(isRTL ? '🎉 الصفقة مكسبة!' : '🎉 Deal marked as Won!'); }}
        />
      )}

      {lostDeal && (
        <LostActionModal
          deal={lostDeal}
          onClose={() => setLostDeal(null)}
          onSuccess={() => { fetchData(); showToast(isRTL ? 'تم تسجيل الخسارة' : 'Deal marked as Lost'); }}
        />
      )}
    </MainLayout>
  );
}

export default function SalesWorkspacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading Sales Pipeline...</p>
        </div>
      </div>
    }>
      <SalesWorkspaceContent />
    </Suspense>
  );
}
