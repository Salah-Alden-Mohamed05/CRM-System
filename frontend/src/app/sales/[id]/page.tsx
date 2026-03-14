'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { salesAPI, tasksAPI, quotationsAPI } from '@/lib/api';
import { Loading } from '@/components/ui';
import {
  ArrowLeft, DollarSign, Calendar, Globe, Edit2, Check, X,
  Phone, Mail, MessageSquare, Clock, Plus, ChevronRight,
  CheckCircle, XCircle, Target, AlertTriangle, Briefcase,
  Activity, FileText, Users, Package, TrendingUp, Save,
  Star, Send, Copy, RefreshCw, Eye, CheckSquare, Square,
  Tag, BarChart2, Zap
} from 'lucide-react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type AnyRecord = Record<string, unknown>;

interface ActivityItem {
  id: string;
  activity_type: string;
  description: string;
  outcome?: string;
  created_at: string;
  user_name?: string;
}

interface Quotation {
  id: string;
  quotation_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'revised';
  total_amount: number;
  currency: string;
  valid_until?: string;
  created_at: string;
  customer_email?: string;
  client_contact_email?: string;
  pdf_generated_at?: string;
  email_sent_count?: number;
  last_email_sent_at?: string;
  last_email_recipient?: string;
}

// ─── Stage Config ──────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'lead',        label: 'Lead',        color: '#94a3b8', bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-300'    },
  { key: 'contacted',   label: 'Contacted',   color: '#3b82f6', bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300'    },
  { key: 'rfq',         label: 'RFQ',         color: '#8b5cf6', bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-300'  },
  { key: 'quotation',   label: 'Quotation',   color: '#f59e0b', bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-300'  },
  { key: 'negotiation', label: 'Negotiation', color: '#f97316', bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300'  },
  { key: 'won',         label: 'Won',         color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  { key: 'lost',        label: 'Lost',        color: '#ef4444', bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300'     },
];

// ─── Quotation Status Config ───────────────────────────────────────────────────
const QUOT_STATUS: Record<string, { label: string; labelAr: string; color: string; bg: string }> = {
  draft:    { label: 'Draft',    labelAr: 'مسودة',     color: 'text-gray-600',    bg: 'bg-gray-100'    },
  sent:     { label: 'Sent',     labelAr: 'مُرسل',     color: 'text-blue-700',    bg: 'bg-blue-100'    },
  accepted: { label: 'Accepted', labelAr: 'مقبول',     color: 'text-emerald-700', bg: 'bg-emerald-100' },
  rejected: { label: 'Rejected', labelAr: 'مرفوض',    color: 'text-red-700',     bg: 'bg-red-100'     },
  expired:  { label: 'Expired',  labelAr: 'منتهي',     color: 'text-orange-700',  bg: 'bg-orange-100'  },
  revised:  { label: 'Revised',  labelAr: 'معدّل',     color: 'text-purple-700',  bg: 'bg-purple-100'  },
};

// ─── Activity Icons / Colors ───────────────────────────────────────────────────
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call:                  <Phone      className="w-4 h-4" />,
  email:                 <Mail       className="w-4 h-4" />,
  email_sent:            <Mail       className="w-4 h-4" />,
  meeting:               <Users      className="w-4 h-4" />,
  note:                  <MessageSquare className="w-4 h-4" />,
  stage_change:          <TrendingUp className="w-4 h-4" />,
  rfq_submitted:         <FileText   className="w-4 h-4" />,
  rfq_created:           <FileText   className="w-4 h-4" />,
  quotation_uploaded:    <FileText   className="w-4 h-4" />,
  quotation_sent:        <Send       className="w-4 h-4" />,
  quotation_accepted:    <CheckCircle className="w-4 h-4" />,
  quotation_rejected:    <XCircle    className="w-4 h-4" />,
  quotation_expired:     <Clock      className="w-4 h-4" />,
  quotation_duplicated:  <Copy       className="w-4 h-4" />,
  deal_won:              <Star       className="w-4 h-4" />,
  deal_lost:             <XCircle    className="w-4 h-4" />,
  lead_converted:        <Zap        className="w-4 h-4" />,
  follow_up:             <RefreshCw  className="w-4 h-4" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  call:                  'bg-blue-100 text-blue-600',
  email:                 'bg-purple-100 text-purple-600',
  email_sent:            'bg-purple-100 text-purple-600',
  meeting:               'bg-orange-100 text-orange-600',
  note:                  'bg-gray-100 text-gray-600',
  stage_change:          'bg-emerald-100 text-emerald-600',
  rfq_submitted:         'bg-violet-100 text-violet-600',
  rfq_created:           'bg-violet-100 text-violet-600',
  quotation_uploaded:    'bg-amber-100 text-amber-600',
  quotation_sent:        'bg-cyan-100 text-cyan-600',
  quotation_accepted:    'bg-green-100 text-green-700',
  quotation_rejected:    'bg-red-100 text-red-600',
  quotation_expired:     'bg-orange-100 text-orange-600',
  quotation_duplicated:  'bg-indigo-100 text-indigo-600',
  deal_won:              'bg-emerald-100 text-emerald-700',
  deal_lost:             'bg-red-100 text-red-600',
  lead_converted:        'bg-yellow-100 text-yellow-700',
  follow_up:             'bg-sky-100 text-sky-600',
};

const ACTIVITY_LABEL: Record<string, string> = {
  call:                  'Call',
  email:                 'Email',
  email_sent:            'Email Sent',
  meeting:               'Meeting',
  note:                  'Note',
  stage_change:          'Stage Change',
  rfq_submitted:         'RFQ Submitted',
  rfq_created:           'RFQ Created',
  quotation_uploaded:    'Quotation Generated',
  quotation_sent:        'Quotation Sent',
  quotation_accepted:    'Quotation Accepted',
  quotation_rejected:    'Quotation Rejected',
  quotation_expired:     'Quotation Expired',
  quotation_duplicated:  'Quotation Duplicated',
  deal_won:              'Deal Won 🎉',
  deal_lost:             'Deal Lost',
  lead_converted:        'Lead Converted',
  follow_up:             'Follow Up',
  other:                 'Other',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);

// ─── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: string; msg: string; type: 'success' | 'error'; }
function Toasts({ list, remove }: { list: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {list.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${t.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {t.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => remove(t.id)}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Send Quotation Email Dialog ───────────────────────────────────────────────
function SendEmailDialog({
  quotation, customerEmail, customerName, onClose, onSent
}: {
  quotation: Quotation;
  customerEmail?: string;
  customerName?: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [form, setForm] = useState({
    recipientEmail: quotation.client_contact_email || customerEmail || '',
    recipientName: customerName || '',
    subject: `Quotation ${quotation.quotation_number} – ${customerName || 'Your Company'}`,
    body: `Dear ${customerName || 'Valued Customer'},\n\nPlease find attached our quotation ${quotation.quotation_number} for your review.\n\nQuotation Details:\n- Total Amount: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: quotation.currency || 'USD' }).format(Number(quotation.total_amount))}\n- Valid Until: ${quotation.valid_until ? format(new Date(quotation.valid_until), 'MMMM d, yyyy') : 'N/A'}\n\nPlease do not hesitate to contact us if you have any questions.\n\nBest regards,`,
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!form.recipientEmail) { setError('Recipient email is required'); return; }
    setSending(true);
    try {
      await quotationsAPI.sendEmail(quotation.id, form);
      onSent();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Send className="w-5 h-5 text-blue-600" /></div>
          <div>
            <h2 className="font-bold text-gray-900">Send Quotation to Customer</h2>
            <p className="text-sm text-gray-500">{quotation.quotation_number} · Total: {fmt(Number(quotation.total_amount))}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient Email *</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.recipientEmail} onChange={e => setForm({ ...form, recipientEmail: e.target.value })} placeholder="customer@company.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient Name</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.recipientName} onChange={e => setForm({ ...form, recipientName: e.target.value })} placeholder="Contact name" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Subject</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Message Body</label>
            <textarea rows={7} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none font-mono" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
          </div>
          {quotation.pdf_generated_at && (
            <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span>PDF generated {formatDistanceToNow(new Date(quotation.pdf_generated_at), { addSuffix: true })} – will be referenced in email</span>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [opp, setOpp] = useState<AnyRecord | null>(null);
  const [tasks, setTasks] = useState<AnyRecord[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'tasks' | 'quotations' | 'notes'>('overview');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call', description: '', outcome: '' });
  const [savingActivity, setSavingActivity] = useState(false);

  // Task quick-add
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', taskType: 'follow_up', priority: 'medium', dueDate: '' });
  const [savingTask, setSavingTask] = useState(false);

  // Edit form
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<AnyRecord>({});

  // Stage move
  const [movingStage, setMovingStage] = useState(false);

  // Email dialog
  const [sendEmailQuot, setSendEmailQuot] = useState<Quotation | null>(null);

  // Duplicate
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const tid = Date.now().toString();
    setToasts(prev => [...prev, { id: tid, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppRes, tasksRes, quotRes] = await Promise.allSettled([
        salesAPI.getOpportunity(id),
        tasksAPI.getAll({ dealId: id, limit: 50 }),
        quotationsAPI.getAll({ dealId: id, limit: 50 }),
      ]);
      if (oppRes.status === 'fulfilled') {
        const data = oppRes.value.data.data as AnyRecord;
        setOpp(data);
        setEditForm({
          title:                data.title || '',
          value:                data.value || 0,
          probability:          data.probability || 0,
          expectedCloseDate:    data.expected_close_date ? String(data.expected_close_date).split('T')[0] : '',
          shippingMode:         data.shipping_mode || '',
          serviceType:          data.service_type || '',
          originCountry:        data.origin_country || '',
          destinationCountry:   data.destination_country || '',
          cargoType:            data.cargo_type || '',
          notes:                data.notes || '',
        });
      }
      if (tasksRes.status === 'fulfilled') {
        setTasks((tasksRes.value.data.data as AnyRecord[]) || []);
      }
      if (quotRes.status === 'fulfilled') {
        const rows = quotRes.value.data.data as Quotation[];
        // Auto-expire locally in the UI
        const today = new Date().toDateString();
        const withExpiry = rows.map(q => {
          if (q.valid_until && new Date(q.valid_until) < new Date() && ['draft','sent'].includes(q.status)) {
            return { ...q, status: 'expired' as const };
          }
          return q;
        });
        setQuotations(withExpiry);
      }
    } catch (e) {
      console.error('loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) loadData(); }, [id, loadData]);

  const handleMoveStage = async (stage: string) => {
    setMovingStage(true);
    try {
      await salesAPI.updateStage(id, { stage });
      addToast(`Deal moved to ${stage}`);
      loadData();
    } catch {
      addToast('Failed to move stage', 'error');
    } finally {
      setMovingStage(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await salesAPI.updateOpportunity(id, editForm);
      setEditing(false);
      addToast('Deal updated');
      loadData();
    } catch {
      addToast('Failed to update deal', 'error');
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingActivity(true);
    try {
      await salesAPI.addActivity(id, activityForm);
      setShowActivityForm(false);
      setActivityForm({ type: 'call', description: '', outcome: '' });
      addToast('Activity logged');
      loadData();
    } catch {
      addToast('Failed to log activity', 'error');
    } finally {
      setSavingActivity(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTask(true);
    try {
      await tasksAPI.create({ ...taskForm, dealId: id, assignedTo: user?.id });
      setShowTaskForm(false);
      setTaskForm({ title: '', taskType: 'follow_up', priority: 'medium', dueDate: '' });
      addToast('Task created');
      loadData();
    } catch {
      addToast('Failed to create task', 'error');
    } finally {
      setSavingTask(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await tasksAPI.complete(taskId);
      addToast('Task completed');
      loadData();
    } catch {
      addToast('Failed to complete task', 'error');
    }
  };

  const handleDuplicateQuotation = async (quotId: string) => {
    setDuplicating(quotId);
    try {
      const res = await quotationsAPI.duplicate(quotId);
      addToast(`Quotation duplicated as ${res.data.data?.quotation_number}`);
      loadData();
    } catch {
      addToast('Failed to duplicate quotation', 'error');
    } finally {
      setDuplicating(null);
    }
  };

  const handleUpdateQuotationStatus = async (quotId: string, status: string) => {
    try {
      await quotationsAPI.update(quotId, { status });
      addToast(`Quotation status updated to ${status}`);
      loadData();
    } catch {
      addToast('Failed to update quotation status', 'error');
    }
  };

  if (loading) return <MainLayout><div className="p-8"><Loading /></div></MainLayout>;
  if (!opp) return (
    <MainLayout>
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
        <p className="text-gray-600">Deal not found</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">← Go back</button>
      </div>
    </MainLayout>
  );

  const currentStage = STAGES.find(s => s.key === opp.stage) || STAGES[0];
  const activeStageIdx = STAGES.findIndex(s => s.key === opp.stage);
  const activities = (opp.activities as ActivityItem[]) || [];
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const overdueTasks  = tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date as string) < new Date()).length;

  const canManage = ['Admin', 'Sales'].includes(user?.role || '');
  const canSendEmail = ['Admin', 'Sales', 'Operations'].includes(user?.role || '');

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* ── Back + Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg mt-0.5 flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="min-w-0">
              {editing ? (
                <input className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent focus:outline-none w-full max-w-xl" value={editForm.title as string} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
              ) : (
                <h1 className="text-xl font-bold text-gray-900 break-words">{opp.title as string}</h1>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <Link href={`/customers/${opp.customer_id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /><span className="break-all">{opp.customer_name as string}</span>
                </Link>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">Updated {opp.updated_at ? formatDistanceToNow(new Date(opp.updated_at as string), { addSuffix: true }) : '—'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"><X className="w-4 h-4" />Cancel</button>
                <button onClick={handleSaveEdit} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Save className="w-4 h-4" />Save</button>
              </>
            ) : (
              <>
                {canManage && <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"><Edit2 className="w-4 h-4" />Edit</button>}
                {opp.stage !== 'won' && opp.stage !== 'lost' && canManage && (
                  <>
                    <button onClick={() => handleMoveStage('won')} disabled={movingStage} className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-60">
                      <Check className="w-4 h-4" />Mark Won
                    </button>
                    <button onClick={() => handleMoveStage('lost')} disabled={movingStage} className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 disabled:opacity-60">
                      <X className="w-4 h-4" />Lost
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Stage Progress Bar ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm overflow-x-auto">
          <div className="flex items-center justify-between mb-3 min-w-0">
            <h2 className="text-sm font-semibold text-gray-700">Deal Stage Progress</h2>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${currentStage.bg} ${currentStage.text} flex-shrink-0`}>
              {currentStage.label}
            </span>
          </div>
          <div className="relative min-w-[500px]">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200">
              <div className="h-full transition-all duration-500"
                style={{
                  width: opp.stage === 'lost' ? '100%' : opp.stage === 'won' ? '100%' : `${(activeStageIdx / (STAGES.length - 2)) * 100}%`,
                  background: opp.stage === 'lost' ? '#ef4444' : opp.stage === 'won' ? '#10b981' : '#3b82f6',
                }}
              />
            </div>
            <div className="relative flex justify-between">
              {STAGES.map((stage, idx) => {
                const isPassed = idx < activeStageIdx;
                const isCurrent = stage.key === opp.stage;
                const isClickable = !['won', 'lost'].includes(opp.stage as string) && !['won', 'lost'].includes(stage.key) && canManage;
                return (
                  <button
                    key={stage.key}
                    disabled={!isClickable || isCurrent || movingStage}
                    onClick={() => isClickable && !isCurrent ? handleMoveStage(stage.key) : undefined}
                    className={`flex flex-col items-center gap-1.5 ${isClickable && !isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10 relative`}
                      style={{
                        borderColor: isCurrent ? stage.color : isPassed ? '#3b82f6' : '#d1d5db',
                        backgroundColor: isCurrent ? stage.color : isPassed ? '#3b82f6' : 'white',
                        color: (isCurrent || isPassed) ? 'white' : '#9ca3af',
                        transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: isCurrent ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                      }}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                    </div>
                    <span className={`text-xs font-medium ${isCurrent ? 'text-gray-900 font-semibold' : isPassed ? 'text-blue-600' : 'text-gray-400'}`}>
                      {stage.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-3 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 mb-1"><DollarSign className="w-4 h-4" /><span className="text-xs text-gray-500">Deal Value</span></div>
            {editing ? (
              <input type="number" className="text-xl font-bold text-gray-900 border-b border-gray-300 bg-transparent focus:outline-none w-full" value={editForm.value as number} onChange={e => setEditForm({ ...editForm, value: parseFloat(e.target.value) || 0 })} />
            ) : (
              <p className="text-xl font-bold text-gray-900">{fmt(Number(opp.value))}</p>
            )}
          </div>
          <div className="bg-white rounded-xl border p-3 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 mb-1"><Target className="w-4 h-4" /><span className="text-xs text-gray-500">Win Probability</span></div>
            {editing ? (
              <input type="number" min="0" max="100" className="text-xl font-bold text-gray-900 border-b border-gray-300 bg-transparent focus:outline-none w-24" value={editForm.probability as number} onChange={e => setEditForm({ ...editForm, probability: parseInt(e.target.value) || 0 })} />
            ) : (
              <>
                <p className="text-xl font-bold text-gray-900">{opp.probability as number}%</p>
                <div className="h-1 bg-gray-100 rounded-full mt-1"><div className="h-full rounded-full bg-blue-500" style={{ width: `${opp.probability}%` }} /></div>
              </>
            )}
          </div>
          <div className="bg-white rounded-xl border p-3 shadow-sm">
            <div className="flex items-center gap-2 text-orange-600 mb-1"><Calendar className="w-4 h-4" /><span className="text-xs text-gray-500">Close Date</span></div>
            {editing ? (
              <input type="date" className="text-sm font-bold text-gray-900 border-b border-gray-300 bg-transparent focus:outline-none w-full" value={editForm.expectedCloseDate as string} onChange={e => setEditForm({ ...editForm, expectedCloseDate: e.target.value })} />
            ) : (
              <p className="text-sm font-bold text-gray-900">
                {opp.expected_close_date ? format(new Date(opp.expected_close_date as string), 'MMM d, yyyy') : '—'}
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border p-3 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600 mb-1"><Activity className="w-4 h-4" /><span className="text-xs text-gray-500">Tasks / Activities</span></div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">{tasks.length}</span>
              <span className="text-gray-300">/</span>
              <span className="text-xl font-bold text-gray-900">{activities.length}</span>
              {overdueTasks > 0 && <span className="text-xs text-red-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{overdueTasks}</span>}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="overflow-x-auto">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit min-w-full md:min-w-fit">
            {([
              { id: 'overview',    label: 'Overview',              icon: Briefcase },
              { id: 'activities',  label: 'Activities',            icon: Activity },
              { id: 'quotations',  label: `Quotations (${quotations.length})`, icon: FileText },
              { id: 'tasks',       label: `Tasks (${tasks.length})`,icon: CheckSquare },
              { id: 'notes',       label: 'Notes',                 icon: MessageSquare },
            ] as { id: typeof activeTab; label: string; icon: React.ElementType }[]).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-600" />Deal Details</h3>
              {[
                { label: 'Service Type', field: 'serviceType', dbField: 'service_type', placeholder: 'FCL, LCL, Air Express...' },
                { label: 'Shipping Mode', field: 'shippingMode', dbField: 'shipping_mode', placeholder: 'sea, air, road...' },
                { label: 'Origin Country', field: 'originCountry', dbField: 'origin_country', placeholder: 'China' },
                { label: 'Destination', field: 'destinationCountry', dbField: 'destination_country', placeholder: 'USA' },
                { label: 'Cargo Type', field: 'cargoType', dbField: 'cargo_type', placeholder: 'General, Hazmat...' },
              ].map(({ label, field, dbField, placeholder }) => (
                <div key={field} className="flex items-center justify-between py-2 border-b border-gray-50 gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
                  {editing ? (
                    <input className="text-sm font-medium text-gray-900 text-right border-b border-gray-300 focus:outline-none flex-1 min-w-0" value={editForm[field] as string || ''} onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} placeholder={placeholder} />
                  ) : (
                    <span className="text-sm font-medium text-gray-900 text-right break-words">{(opp[dbField] as string) || '—'}</span>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between py-2 gap-2">
                <span className="text-sm text-gray-500">Assigned To</span>
                <span className="text-sm font-medium text-gray-900">{(opp.assigned_to_name as string) || '—'}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-blue-600" />Customer</h3>
                <Link href={`/customers/${opp.customer_id}`} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(opp.customer_name as string || 'C').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{opp.customer_name as string}</p>
                    <p className="text-xs text-gray-500">{opp.customer_country as string || 'N/A'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                </Link>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3"><TrendingUp className="w-5 h-5 text-purple-600" />Weighted Value</h3>
                <p className="text-2xl font-bold text-purple-600">{fmt(Number(opp.value) * Number(opp.probability) / 100)}</p>
                <p className="text-xs text-gray-400 mt-1">{fmt(Number(opp.value))} × {opp.probability as number}% probability</p>
              </div>
            </div>
          </div>
        )}

        {/* ══ QUOTATIONS TAB ══ */}
        {activeTab === 'quotations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-900">Quotations</h3>
              <Link href={`/quotations/new?dealId=${id}`} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />New Quotation
              </Link>
            </div>

            {quotations.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="font-medium text-gray-500">No quotations yet</p>
                <p className="text-sm mt-1">Create a quotation to send to this customer</p>
                <Link href={`/quotations/new?dealId=${id}`} className="inline-flex items-center gap-1 mt-3 text-blue-600 hover:underline text-sm">
                  <Plus className="w-3.5 h-3.5" />Create first quotation →
                </Link>
              </div>
            )}

            <div className="space-y-3">
              {quotations.map(q => {
                const statusCfg = QUOT_STATUS[q.status] || QUOT_STATUS.draft;
                const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && ['draft','sent'].includes(q.status);
                return (
                  <div key={q.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isExpired ? 'border-orange-200' : 'border-gray-200'}`}>
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{q.quotation_number}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                            {isExpired && q.status !== 'expired' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">Expired</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {format(new Date(q.created_at), 'MMM d, yyyy')}
                            {q.valid_until && <> · Valid until {format(new Date(q.valid_until), 'MMM d, yyyy')}</>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-gray-900">{fmt(Number(q.total_amount))}</p>
                        <p className="text-xs text-gray-400">{q.currency}</p>
                      </div>
                    </div>

                    {/* Email history */}
                    {(q.email_sent_count || 0) > 0 && (
                      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        Sent {q.email_sent_count} time{(q.email_sent_count || 0) > 1 ? 's' : ''} · Last sent to {q.last_email_recipient} {q.last_email_sent_at ? formatDistanceToNow(new Date(q.last_email_sent_at), { addSuffix: true }) : ''}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 p-3">
                      {/* Send Email */}
                      {canSendEmail && q.status !== 'expired' && (
                        <button
                          onClick={() => setSendEmailQuot(q)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                        >
                          <Send className="w-3.5 h-3.5" />Send to Customer
                        </button>
                      )}

                      {/* View PDF */}
                      <Link
                        href={`/quotations/${q.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200"
                      >
                        <Eye className="w-3.5 h-3.5" />View
                      </Link>

                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicateQuotation(q.id)}
                        disabled={duplicating === q.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs rounded-lg hover:bg-indigo-100 disabled:opacity-60"
                      >
                        {duplicating === q.id ? <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                        Duplicate
                      </button>

                      {/* Status change */}
                      {canManage && !['expired'].includes(q.status) && (
                        <select
                          value={q.status}
                          onChange={e => handleUpdateQuotationStatus(q.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                          <option value="revised">Revised</option>
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ ACTIVITIES TAB ══ */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
              <button onClick={() => setShowActivityForm(!showActivityForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />Log Activity
              </button>
            </div>

            {showActivityForm && (
              <form onSubmit={handleAddActivity} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Activity Type</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={activityForm.type} onChange={e => setActivityForm({ ...activityForm, type: e.target.value })}>
                      {['call', 'email', 'meeting', 'note', 'follow_up', 'other'].map(t => <option key={t} value={t}>{ACTIVITY_LABEL[t] || t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Outcome (optional)</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={activityForm.outcome} onChange={e => setActivityForm({ ...activityForm, outcome: e.target.value })} placeholder="Positive, callback needed..." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none" rows={3} value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} placeholder="What happened? What was discussed?" required />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowActivityForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={savingActivity} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1">
                    {savingActivity && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Log Activity
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {activities.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No activities logged yet</p>
                  <button onClick={() => setShowActivityForm(true)} className="text-blue-600 hover:underline text-sm mt-1">Log first activity →</button>
                </div>
              )}
              {activities.map((act) => (
                <div key={act.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[act.activity_type] || 'bg-gray-100 text-gray-600'}`}>
                    {ACTIVITY_ICONS[act.activity_type] || <MessageSquare className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700">{ACTIVITY_LABEL[act.activity_type] || act.activity_type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {act.created_at ? formatDistanceToNow(new Date(act.created_at), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 break-words">{act.description}</p>
                    {act.outcome && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" />Outcome: {act.outcome}</p>}
                    {act.user_name && <p className="text-xs text-gray-400 mt-1">by {act.user_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ TASKS TAB ══ */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-gray-900">
                Tasks <span className="text-sm font-normal text-gray-400">({completedTasks}/{tasks.length} done)</span>
                {overdueTasks > 0 && <span className="text-xs text-red-500 ml-2 inline-flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{overdueTasks} overdue</span>}
              </h3>
              <button onClick={() => setShowTaskForm(!showTaskForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />Add Task
              </button>
            </div>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Task Title *</label>
                    <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Send follow-up email..." required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={taskForm.taskType} onChange={e => setTaskForm({ ...taskForm, taskType: e.target.value })}>
                      {['follow_up', 'call', 'email', 'meeting', 'proposal', 'rfq_preparation', 'quotation_review', 'other'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                      {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowTaskForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={savingTask} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1">
                    {savingTask && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    Create Task
                  </button>
                </div>
              </form>
            )}

            {tasks.length > 0 && (
              <div className="bg-white rounded-xl border p-3 flex items-center gap-4">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-medium text-gray-700 flex-shrink-0">{completedTasks}/{tasks.length} completed</span>
              </div>
            )}

            <div className="space-y-2">
              {tasks.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No tasks yet</p>
                  <button onClick={() => setShowTaskForm(true)} className="text-blue-600 hover:underline text-sm mt-1">Create first task →</button>
                </div>
              )}
              {tasks.map(task => {
                const isOverdue = Boolean(task.due_date && new Date(task.due_date as string) < new Date() && task.status !== 'completed');
                const statusColors: Record<string, string> = {
                  completed: 'bg-green-100 text-green-700',
                  in_progress: 'bg-blue-100 text-blue-700',
                  pending: 'bg-yellow-100 text-yellow-700',
                  blocked: 'bg-red-100 text-red-700',
                  cancelled: 'bg-gray-100 text-gray-500',
                };
                return (
                  <div key={task.id as string} className={`bg-white rounded-xl border p-4 flex items-start gap-3 shadow-sm ${isOverdue ? 'border-orange-200' : 'border-gray-100'}`}>
                    <button
                      onClick={() => task.status !== 'completed' ? handleCompleteTask(task.id as string) : undefined}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${task.status === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-400'}`}
                    >
                      {task.status === 'completed' && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium break-words ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title as string}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${task.priority === 'urgent' ? 'bg-red-100 text-red-600' : task.priority === 'high' ? 'bg-orange-100 text-orange-600' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                          {task.priority as string}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColors[task.status as string] || 'bg-gray-100 text-gray-500'}`}>
                          {(task.status as string).replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400 capitalize">{(task.task_type as string || '').replace(/_/g, ' ')}</span>
                        {(task.due_date as string | null) && (
                          <span className={`text-xs flex items-center gap-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                            <Clock className="w-3 h-3" />
                            {format(new Date(task.due_date as string), 'MMM d')}
                            {isOverdue && ' (overdue)'}
                          </span>
                        )}
                        {(task.checklist_total as number) > 0 && (
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <CheckSquare className="w-3 h-3" />
                            {task.checklist_done as number}/{task.checklist_total as number}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href="/tasks" className="text-xs text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ NOTES TAB ══ */}
        {activeTab === 'notes' && (
          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-gray-600" />Deal Notes</h3>
            {editing ? (
              <textarea
                className="w-full border border-gray-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 resize-none min-h-[200px]"
                value={editForm.notes as string}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Internal notes, client requirements, special instructions..."
              />
            ) : (
              <div className="min-h-[150px]">
                {opp.notes ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{opp.notes as string}</p>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No notes yet</p>
                    {canManage && <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline text-sm mt-1">Add notes →</button>}
                  </div>
                )}
              </div>
            )}
            {(opp.loss_reason as string | null) && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700">Loss Reason</p>
                <p className="text-sm text-red-600 mt-0.5">{opp.loss_reason as string}</p>
              </div>
            )}
          </div>
        )}

        <Toasts list={toasts} remove={tid => setToasts(prev => prev.filter(t => t.id !== tid))} />

        {/* ── Send Email Dialog ── */}
        {sendEmailQuot && (
          <SendEmailDialog
            quotation={sendEmailQuot}
            customerEmail={opp.customer_email as string | undefined}
            customerName={opp.customer_name as string | undefined}
            onClose={() => setSendEmailQuot(null)}
            onSent={() => { addToast('Email sent & logged successfully!'); loadData(); }}
          />
        )}
      </div>
    </MainLayout>
  );
}
