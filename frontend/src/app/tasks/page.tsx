'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { tasksAPI, customersAPI, salesAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { format, isAfter, parseISO } from 'date-fns';
import {
  Plus, Search, CheckCircle2, Clock, AlertTriangle, X,
  Phone, Mail, Users, Calendar, FileText, Star, Briefcase,
  ChevronDown, Filter, Edit3, Trash2, Check, RefreshCw,
  ClipboardList, TrendingUp, BarChart2, User, XCircle,
  MessageSquare, Target, PlayCircle, ChevronUp
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────
interface Task {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  opportunity_id?: string;
  lead_id?: string;
  customer_id?: string;
  opportunity_title?: string;
  lead_company?: string;
  customer_name?: string;
  task_type: string;
  title: string;
  description?: string;
  outcome?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface TaskStats {
  pending: string;
  in_progress: string;
  completed: string;
  cancelled: string;
  overdue: string;
  total: string;
  perUser?: Array<{
    id: string;
    name: string;
    email: string;
    total: string;
    completed: string;
    pending: string;
  }>;
}

interface Customer { id: string; company_name: string; }
interface Opportunity { id: string; title: string; customer_name?: string; }

// ── Constants ──────────────────────────────────────────────
const TASK_TYPES = [
  { value: 'call',        label: 'Phone Call',    labelAr: 'مكالمة هاتفية', icon: Phone },
  { value: 'email',       label: 'Email',         labelAr: 'بريد إلكتروني',  icon: Mail },
  { value: 'meeting',     label: 'Meeting',       labelAr: 'اجتماع',         icon: Users },
  { value: 'follow_up',   label: 'Follow-up',     labelAr: 'متابعة',         icon: RefreshCw },
  { value: 'demo',        label: 'Demo',          labelAr: 'عرض تجريبي',     icon: PlayCircle },
  { value: 'proposal',    label: 'Proposal',      labelAr: 'عرض سعر',        icon: FileText },
  { value: 'negotiation', label: 'Negotiation',   labelAr: 'تفاوض',          icon: TrendingUp },
  { value: 'site_visit',  label: 'Site Visit',    labelAr: 'زيارة ميدانية', icon: Briefcase },
  { value: 'note',        label: 'Note',          labelAr: 'ملاحظة',         icon: MessageSquare },
  { value: 'other',       label: 'Other',         labelAr: 'أخرى',           icon: ClipboardList },
];

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent',  labelAr: 'عاجل',    color: 'bg-red-100 text-red-700 border border-red-200' },
  high:   { label: 'High',    labelAr: 'عالي',    color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  medium: { label: 'Medium',  labelAr: 'متوسط',   color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
  low:    { label: 'Low',     labelAr: 'منخفض',   color: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     labelAr: 'معلق',       color: 'bg-gray-100 text-gray-700',   icon: Clock },
  in_progress: { label: 'In Progress', labelAr: 'جاري',       color: 'bg-blue-100 text-blue-700',   icon: PlayCircle },
  completed:   { label: 'Completed',   labelAr: 'مكتمل',      color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   labelAr: 'ملغي',       color: 'bg-red-100 text-red-600',     icon: XCircle },
};

// ── Task Form Modal ─────────────────────────────────────────
interface TaskFormProps {
  task?: Task | null;
  customers: Customer[];
  opportunities: Opportunity[];
  isAdmin: boolean;
  isRTL: boolean;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

function TaskFormModal({ task, customers, opportunities, isAdmin: _isAdmin, isRTL, onSave, onClose }: TaskFormProps) {
  const isEditing = !!task;
  const [form, setForm] = useState({
    title:         task?.title         || '',
    taskType:      task?.task_type     || 'call',
    description:   task?.description   || '',
    outcome:       task?.outcome       || '',
    status:        task?.status        || 'pending',
    priority:      task?.priority      || 'medium',
    dueDate:       task?.due_date      ? task.due_date.slice(0, 16) : '',
    customerId:    task?.customer_id   || '',
    opportunityId: task?.opportunity_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        title:         form.title,
        taskType:      form.taskType,
        description:   form.description || null,
        outcome:       form.outcome || null,
        status:        form.status,
        priority:      form.priority,
        dueDate:       form.dueDate || null,
        customerId:    form.customerId || null,
        opportunityId: form.opportunityId || null,
      });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save task');
      setSaving(false);
    }
  };

  const dir = isRTL ? 'rtl' : 'ltr';
  const selectedType = TASK_TYPES.find(t => t.value === form.taskType);
  const TypeIcon = selectedType?.icon || ClipboardList;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-blue-600" />
            {isEditing ? (isRTL ? 'تعديل المهمة' : 'Edit Task') : (isRTL ? 'مهمة جديدة' : 'Log New Task')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isRTL ? 'نوع الإجراء' : 'Action Type'} *
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {TASK_TYPES.map(tt => {
                const TIcon = tt.icon;
                return (
                  <button
                    key={tt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, taskType: tt.value }))}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                      form.taskType === tt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <TIcon className="w-4 h-4" />
                    {isRTL ? tt.labelAr : tt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isRTL ? 'العنوان' : 'Title'} *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder={isRTL ? 'مثال: مكالمة مع شركة ...' : 'e.g. Call with TechCorp regarding proposal'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isRTL ? 'التفاصيل' : 'Details / Notes'}
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder={isRTL ? 'تفاصيل الإجراء...' : 'What happened? What was discussed?'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Outcome (for completed) */}
          {(form.status === 'completed' || isEditing) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isRTL ? 'النتيجة' : 'Outcome / Result'}
              </label>
              <textarea
                rows={2}
                value={form.outcome}
                onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))}
                placeholder={isRTL ? 'ما هي نتيجة هذا الإجراء؟' : 'What was the outcome?'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {/* Priority + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isRTL ? 'الأولوية' : 'Priority'}
              </label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{isRTL ? cfg.labelAr : cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isRTL ? 'الحالة' : 'Status'}
              </label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as 'pending' | 'in_progress' | 'completed' | 'cancelled' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{isRTL ? cfg.labelAr : cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isRTL ? 'الموعد النهائي' : 'Due Date'} ({isRTL ? 'اختياري' : 'optional'})
            </label>
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Link to Customer / Opportunity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isRTL ? 'ربط بعميل' : 'Link to Customer'}
              </label>
              <select
                value={form.customerId}
                onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{isRTL ? '— بدون —' : '— None —'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isRTL ? 'ربط بفرصة' : 'Link to Opportunity'}
              </label>
              <select
                value={form.opportunityId}
                onChange={e => setForm(p => ({ ...p, opportunityId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{isRTL ? '— بدون —' : '— None —'}</option>
                {opportunities.map(o => (
                  <option key={o.id} value={o.id}>{o.title}{o.customer_name ? ` (${o.customer_name})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {saving
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : (isEditing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />)
              }
              {saving
                ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                : (isEditing ? (isRTL ? 'حفظ' : 'Save Changes') : (isRTL ? 'تسجيل المهمة' : 'Log Task'))
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Complete Task Modal ─────────────────────────────────────
function CompleteModal({ task, isRTL, onConfirm, onClose }: {
  task: Task;
  isRTL: boolean;
  onConfirm: (outcome: string) => Promise<void>;
  onClose: () => void;
}) {
  const [outcome, setOutcome] = useState(task.outcome || '');
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{isRTL ? 'إتمام المهمة' : 'Complete Task'}</h3>
            <p className="text-sm text-gray-500">{task.title}</p>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {isRTL ? 'النتيجة (اختياري)' : 'Outcome / Result (optional)'}
          </label>
          <textarea
            rows={3}
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder={isRTL ? 'ماذا حدث؟ ما النتيجة؟' : 'What was the result? Any next steps?'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            disabled={saving}
            onClick={async () => { setSaving(true); await onConfirm(outcome); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isRTL ? 'تأكيد الإتمام' : 'Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Task Card ───────────────────────────────────────────────
function TaskCard({
  task, isAdmin, isRTL,
  onComplete, onEdit, onDelete
}: {
  task: Task;
  isAdmin: boolean;
  isRTL: boolean;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const taskType = TASK_TYPES.find(t => t.value === task.task_type);
  const TypeIcon = taskType?.icon || ClipboardList;
  const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG];
  const statusCfg = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG];
  const StatusIcon = statusCfg.icon;

  const isOverdue = task.due_date && task.status !== 'completed' && task.status !== 'cancelled'
    && isAfter(new Date(), parseISO(task.due_date));

  const isCompleted = task.status === 'completed';

  return (
    <div className={`bg-white rounded-xl border ${
      isCompleted ? 'border-green-200 opacity-75' :
      isOverdue   ? 'border-red-200' : 'border-gray-200'
    } p-4 hover:shadow-md transition-all group`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            isCompleted ? 'bg-green-100' : isOverdue ? 'bg-red-100' : 'bg-blue-50'
          }`}>
            <TypeIcon className={`w-4 h-4 ${isCompleted ? 'text-green-600' : isOverdue ? 'text-red-500' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm text-gray-900 leading-tight ${isCompleted ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </p>
            {isAdmin && task.user_name && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <User className="w-3 h-3" /> {task.user_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityCfg.color}`}>
            {isRTL ? priorityCfg.labelAr : priorityCfg.label}
          </span>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Outcome */}
      {task.outcome && (
        <div className="mb-3 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs font-medium text-green-700 mb-0.5">{isRTL ? 'النتيجة:' : 'Outcome:'}</p>
          <p className="text-xs text-green-600">{task.outcome}</p>
        </div>
      )}

      {/* Links */}
      {(task.customer_name || task.opportunity_title || task.lead_company) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.customer_name && (
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-100">
              🏢 {task.customer_name}
            </span>
          )}
          {task.opportunity_title && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
              🎯 {task.opportunity_title}
            </span>
          )}
          {task.lead_company && (
            <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-100">
              ⚡ {task.lead_company}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusCfg.color}`}>
            <StatusIcon className="w-3 h-3" />
            {isRTL ? statusCfg.labelAr : statusCfg.label}
          </span>
          {isOverdue && (
            <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border border-red-200">
              <AlertTriangle className="w-3 h-3" />
              {isRTL ? 'متأخر' : 'Overdue'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isCompleted && (
            <button
              onClick={() => onComplete(task)}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title={isRTL ? 'إتمام' : 'Mark Complete'}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={isRTL ? 'تعديل' : 'Edit'}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(task)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title={isRTL ? 'حذف' : 'Delete'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs text-gray-400">
          {task.due_date
            ? format(parseISO(task.due_date), 'MMM d')
            : format(parseISO(task.created_at), 'MMM d')
          }
        </span>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function TasksPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'Admin';
  const isRTL = false; // simple default; can hook into language context

  // State
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [stats, setStats]         = useState<TaskStats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);

  // Filters
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, setFilterType]       = useState('');
  const [showFilters, setShowFilters]     = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask]         = useState<Task | null>(null);
  const [completingTask, setCompletingTask]   = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId]   = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStatus)   params.status   = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      if (filterType)     params.taskType = filterType;
      if (search)         params.search   = search;
      params.limit = '100';

      const [tasksRes, statsRes] = await Promise.all([
        tasksAPI.getAll(params),
        tasksAPI.getStats(),
      ]);

      setTasks(tasksRes.data.data || []);
      setTotal(tasksRes.data.total || 0);
      setStats(statsRes.data.data || null);
    } catch {
      showToast('Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, filterType, search, showToast]);

  const loadDropdownData = useCallback(async () => {
    try {
      const [custRes, oppRes] = await Promise.all([
        customersAPI.getAll({ limit: 100 }),
        salesAPI.getOpportunities({ limit: 100 }),
      ]);
      setCustomers(custRes.data.data || []);
      setOpportunities(oppRes.data.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    loadDropdownData();
  }, [isAuthenticated, router, loadDropdownData]);

  useEffect(() => {
    if (isAuthenticated) loadTasks();
  }, [isAuthenticated, loadTasks]);

  // Handlers
  const handleCreate = async (data: Record<string, unknown>) => {
    await tasksAPI.create(data);
    showToast('Task logged successfully!');
    setShowCreateModal(false);
    loadTasks();
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editingTask) return;
    await tasksAPI.update(editingTask.id, data);
    showToast('Task updated');
    setEditingTask(null);
    loadTasks();
  };

  const handleComplete = async (outcome: string) => {
    if (!completingTask) return;
    await tasksAPI.complete(completingTask.id, { outcome });
    showToast('Task completed!');
    setCompletingTask(null);
    loadTasks();
  };

  const handleDelete = async (taskId: string) => {
    try {
      await tasksAPI.delete(taskId);
      showToast('Task deleted');
      setDeletingTaskId(null);
      loadTasks();
    } catch {
      showToast('Failed to delete task', 'error');
    }
  };

  // Filter tasks client-side for showing/hiding completed
  const visibleTasks = tasks.filter(t => {
    if (!showCompleted && (t.status === 'completed' || t.status === 'cancelled')) return false;
    return true;
  });

  const pendingCount     = parseInt(stats?.pending || '0');
  const inProgressCount  = parseInt(stats?.in_progress || '0');
  const completedCount   = parseInt(stats?.completed || '0');
  const overdueCount     = parseInt(stats?.overdue || '0');

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-blue-600" />
              {isRTL ? 'سجل المهام والإجراءات' : 'Task & Activity Log'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isAdmin
                ? (isRTL ? 'جميع مهام الفريق' : `Team activity log · ${total} total tasks`)
                : (isRTL ? 'سجل مهامك ونشاطك اليومي' : 'Log and track your daily sales activities')
              }
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            {isRTL ? 'تسجيل إجراء جديد' : 'Log New Task'}
          </button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: isRTL ? 'معلق' : 'Pending',     val: pendingCount,     icon: Clock,        color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
            { label: isRTL ? 'جاري' : 'In Progress', val: inProgressCount,  icon: PlayCircle,   color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { label: isRTL ? 'مكتمل' : 'Completed',  val: completedCount,   icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
            { label: isRTL ? 'متأخر' : 'Overdue',    val: overdueCount,     icon: AlertTriangle,color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
          ].map(s => {
            const SIcon = s.icon;
            return (
              <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <SIcon className={`w-4 h-4 ${s.color}`} />
                  <span className="text-xs font-medium text-gray-500">{s.label}</span>
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              </div>
            );
          })}
        </div>

        {/* Admin per-user breakdown */}
        {isAdmin && stats?.perUser && stats.perUser.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              {isRTL ? 'إحصائيات الفريق' : 'Team Breakdown'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.perUser.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-700">
                      {u.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.total} tasks · {u.completed} done</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-green-600">{u.completed}</div>
                    <div className="text-xs text-gray-400">done</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search + Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isRTL ? 'بحث في المهام...' : 'Search tasks...'}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              <Filter className="w-4 h-4" />
              {isRTL ? 'فلترة' : 'Filters'}
              {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium ${showCompleted ? 'bg-green-50 border-green-200 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {showCompleted ? (isRTL ? 'إخفاء المكتملة' : 'Hide Completed') : (isRTL ? 'إظهار المكتملة' : 'Show Completed')}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{isRTL ? 'الحالة' : 'Status'}</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">{isRTL ? 'الكل' : 'All'}</option>
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{isRTL ? cfg.labelAr : cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{isRTL ? 'الأولوية' : 'Priority'}</label>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">{isRTL ? 'الكل' : 'All'}</option>
                  {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{isRTL ? cfg.labelAr : cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{isRTL ? 'نوع الإجراء' : 'Action Type'}</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">{isRTL ? 'الكل' : 'All'}</option>
                  {TASK_TYPES.map(tt => (
                    <option key={tt.value} value={tt.value}>{isRTL ? tt.labelAr : tt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="text-center py-20">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-500 mb-1">
              {isRTL ? 'لا توجد مهام' : 'No tasks found'}
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {isRTL ? 'ابدأ بتسجيل إجراءاتك اليومية' : 'Start logging your daily sales activities'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              {isRTL ? 'تسجيل أول إجراء' : 'Log First Task'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group by status */}
            {(['in_progress', 'pending', 'completed', 'cancelled'] as const).map(statusGroup => {
              const groupTasks = visibleTasks.filter(t => t.status === statusGroup);
              if (groupTasks.length === 0) return null;
              const cfg = STATUS_CONFIG[statusGroup];
              const GIcon = cfg.icon;
              return (
                <div key={statusGroup}>
                  <div className="flex items-center gap-2 mb-3">
                    <GIcon className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-600">
                      {isRTL ? cfg.labelAr : cfg.label}
                    </h3>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{groupTasks.length}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {groupTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isAdmin={isAdmin}
                        isRTL={isRTL}
                        onComplete={setCompletingTask}
                        onEdit={setEditingTask}
                        onDelete={t => setDeletingTaskId(t.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modals */}
        {showCreateModal && (
          <TaskFormModal
            customers={customers}
            opportunities={opportunities}
            isAdmin={isAdmin}
            isRTL={isRTL}
            onSave={handleCreate}
            onClose={() => setShowCreateModal(false)}
          />
        )}
        {editingTask && (
          <TaskFormModal
            task={editingTask}
            customers={customers}
            opportunities={opportunities}
            isAdmin={isAdmin}
            isRTL={isRTL}
            onSave={handleUpdate}
            onClose={() => setEditingTask(null)}
          />
        )}
        {completingTask && (
          <CompleteModal
            task={completingTask}
            isRTL={isRTL}
            onConfirm={handleComplete}
            onClose={() => setCompletingTask(null)}
          />
        )}
        {deletingTaskId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {isRTL ? 'حذف المهمة' : 'Delete Task'}
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                {isRTL ? 'هل أنت متأكد؟ لا يمكن التراجع.' : 'Are you sure? This cannot be undone.'}
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setDeletingTaskId(null)} className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={() => handleDelete(deletingTaskId)} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  {isRTL ? 'حذف' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
