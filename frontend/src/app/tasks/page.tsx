'use client';
import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/lib/i18n';
import { tasksAPI, customersAPI, salesAPI } from '@/lib/api';
import {
  Plus, Search, Filter, CheckCircle2, Clock, XCircle, PlayCircle,
  ChevronDown, ChevronUp, Trash2, Edit3, CheckSquare, Square,
  ClipboardList, RefreshCw, AlertCircle, Phone, Mail, Users,
  Calendar, Tag, Building2, Link, FileText, ChevronRight, X,
  BarChart2, Target, Briefcase, StickyNote, ListChecks, Info,
  Zap, TrendingUp
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ChecklistItem { id: string; title: string; is_done: boolean; sort_order: number; }
interface Task {
  id: string; title: string; task_type: string; description?: string;
  required_actions?: string; notes?: string; outcome?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string; completed_at?: string; created_at: string;
  user_name?: string; assigned_to_name?: string;
  deal_title?: string; deal_number?: string;
  customer_name?: string; shipment_reference?: string;
  checklist?: ChecklistItem[];
  checklist_total?: number; checklist_done?: number;
  progress_pct?: number;
}
interface TaskStats {
  pending: number; in_progress: number; completed: number;
  cancelled: number; overdue: number; total: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:     { label:'Pending',     labelAr:'في الانتظار', color:'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  in_progress: { label:'In Progress', labelAr:'جاري',       color:'bg-blue-100 text-blue-700 border-blue-200',       icon: PlayCircle },
  completed:   { label:'Completed',   labelAr:'مكتملة',     color:'bg-green-100 text-green-700 border-green-200',    icon: CheckCircle2 },
  cancelled:   { label:'Cancelled',   labelAr:'ملغاة',      color:'bg-gray-100 text-gray-600 border-gray-200',       icon: XCircle },
} as const;

const PRIORITY_CONFIG = {
  low:    { label:'Low',    labelAr:'منخفضة', color:'bg-slate-100 text-slate-600',   dot:'bg-slate-400' },
  medium: { label:'Medium', labelAr:'متوسطة', color:'bg-blue-100 text-blue-600',     dot:'bg-blue-400' },
  high:   { label:'High',   labelAr:'عالية',  color:'bg-orange-100 text-orange-600', dot:'bg-orange-500' },
  urgent: { label:'Urgent', labelAr:'عاجلة',  color:'bg-red-100 text-red-700',       dot:'bg-red-500' },
} as const;

const TASK_TYPES = [
  { value:'call',              label:'Call',               labelAr:'مكالمة' },
  { value:'email',             label:'Email',              labelAr:'بريد إلكتروني' },
  { value:'meeting',           label:'Meeting',            labelAr:'اجتماع' },
  { value:'follow_up',         label:'Follow Up',          labelAr:'متابعة' },
  { value:'demo',              label:'Demo',               labelAr:'عرض تجريبي' },
  { value:'proposal',          label:'Proposal',           labelAr:'مقترح' },
  { value:'rfq_preparation',   label:'RFQ Preparation',    labelAr:'إعداد طلب عرض أسعار' },
  { value:'quotation_review',  label:'Quotation Review',   labelAr:'مراجعة العرض' },
  { value:'negotiation',       label:'Negotiation',        labelAr:'تفاوض' },
  { value:'site_visit',        label:'Site Visit',         labelAr:'زيارة موقع' },
  { value:'shipment_booking',  label:'Shipment Booking',   labelAr:'حجز شحنة' },
  { value:'document_collection',label:'Document Collection',labelAr:'جمع المستندات' },
  { value:'customs_filing',    label:'Customs Filing',     labelAr:'تقديم جمارك' },
  { value:'delivery',          label:'Delivery',           labelAr:'تسليم' },
  { value:'note',              label:'Note',               labelAr:'ملاحظة' },
  { value:'other',             label:'Other',              labelAr:'أخرى' },
];

// ─── Progress Bar Component ───────────────────────────────────────────────────
function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">Progress</span>
        <span className="text-xs font-semibold text-gray-700">{done}/{total} ({pct}%)</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Task Detail Modal (full view with checklist) ────────────────────────────
function TaskDetailModal({ task: initialTask, onClose, onUpdate, isRTL }: {
  task: Task; onClose: () => void; onUpdate: (t: Task) => void; isRTL: boolean;
}) {
  const [task, setTask] = useState<Task>(initialTask);
  const [newItem, setNewItem] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const checklist: ChecklistItem[] = task.checklist || [];
  const done = checklist.filter(i => i.is_done).length;
  const total = checklist.length;

  const toggleItem = async (itemId: string, currentDone: boolean) => {
    try {
      await tasksAPI.toggleChecklistItem(task.id, itemId, !currentDone);
      const updated = await tasksAPI.getById(task.id);
      const t = updated.data?.data || updated.data;
      setTask(t); onUpdate(t);
    } catch {}
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    setAddingItem(true);
    try {
      await tasksAPI.addChecklistItem(task.id, { title: newItem.trim() });
      const updated = await tasksAPI.getById(task.id);
      const t = updated.data?.data || updated.data;
      setTask(t); onUpdate(t);
      setNewItem('');
    } catch {} finally { setAddingItem(false); }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await tasksAPI.deleteChecklistItem(task.id, itemId);
      const updated = await tasksAPI.getById(task.id);
      const t = updated.data?.data || updated.data;
      setTask(t); onUpdate(t);
    } catch {}
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const updated = await tasksAPI.update(task.id, { notes });
      const t = updated.data?.data || updated.data;
      setTask(t); onUpdate(t);
    } catch {} finally { setSavingNotes(false); }
  };

  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const taskTypeCfg = TASK_TYPES.find(t => t.value === task.task_type);

  const isOverdue = task.due_date && task.status !== 'completed' && new Date(task.due_date) < new Date();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                  <statusCfg.icon className="w-3 h-3" />
                  {isRTL ? statusCfg.labelAr : statusCfg.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.color}`}>
                  <div className={`w-2 h-2 rounded-full ${priorityCfg.dot}`} />
                  {isRTL ? priorityCfg.labelAr : priorityCfg.label}
                </span>
                {taskTypeCfg && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                    <Tag className="w-3 h-3 mr-1" />
                    {isRTL ? taskTypeCfg.labelAr : taskTypeCfg.label}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {task.due_date && (
              <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                <Calendar className="w-4 h-4" />
                <span>Due: <strong>{new Date(task.due_date).toLocaleDateString()}</strong></span>
                {isOverdue && <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded">Overdue</span>}
              </div>
            )}
            {task.assigned_to_name && (
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-4 h-4" />
                <span>Assigned: <strong>{task.assigned_to_name}</strong></span>
              </div>
            )}
            {task.deal_title && (
              <div className="flex items-center gap-2 text-gray-600">
                <Briefcase className="w-4 h-4" />
                <span>Deal: <strong>{task.deal_number} – {task.deal_title}</strong></span>
              </div>
            )}
            {task.customer_name && (
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 className="w-4 h-4" />
                <span>Customer: <strong>{task.customer_name}</strong></span>
              </div>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Info className="w-4 h-4 text-blue-500" />
                Description
              </h3>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Required Actions */}
          {task.required_actions && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Zap className="w-4 h-4 text-orange-500" />
                Required Actions
              </h3>
              <div className="text-sm text-gray-600 bg-orange-50 border border-orange-100 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                {task.required_actions}
              </div>
            </div>
          )}

          {/* Checklist / Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <ListChecks className="w-4 h-4 text-green-500" />
                Sub-tasks / Checklist
                {total > 0 && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{done}/{total}</span>}
              </h3>
            </div>

            {total > 0 && <ProgressBar done={done} total={total} />}

            <div className="mt-3 space-y-2">
              {checklist.map(item => (
                <div key={item.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${item.is_done ? 'bg-green-50 border-green-100 opacity-80' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                  <button
                    onClick={() => toggleItem(item.id, item.is_done)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${item.is_done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}
                  >
                    {item.is_done && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.is_done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.title}
                  </span>
                  <button onClick={() => deleteItem(item.id)} className="p-1 text-gray-300 hover:text-red-400 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Add new checklist item */}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                  placeholder="Add a sub-task..."
                  className="flex-1 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-solid focus:border-blue-300"
                />
                <button
                  onClick={addItem}
                  disabled={addingItem || !newItem.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <StickyNote className="w-4 h-4 text-yellow-500" />
              Notes
            </h3>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes, observations, or updates..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {notes !== (task.notes || '') && (
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            )}
          </div>

          {/* Outcome (if completed) */}
          {task.outcome && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Target className="w-4 h-4 text-purple-500" />
                Outcome
              </h3>
              <p className="text-sm text-gray-600 bg-purple-50 border border-purple-100 rounded-lg p-3">{task.outcome}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────
function TaskFormModal({ task, customers, deals, isAdmin, isRTL, onSave, onClose }: {
  task?: Task; customers: any[]; deals: any[]; isAdmin: boolean; isRTL: boolean;
  onSave: (data: any) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: task?.title || '',
    taskType: task?.task_type || 'call',
    description: task?.description || '',
    requiredActions: task?.required_actions || '',
    priority: task?.priority || 'medium',
    status: task?.status || 'pending',
    dueDate: task?.due_date ? task.due_date.split('T')[0] : '',
    customerId: '',
    dealId: '',
    notes: task?.notes || '',
    checklist: [] as string[],
    newChecklistItem: '',
  });
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const addToChecklist = () => {
    if (!form.newChecklistItem.trim()) return;
    setChecklistItems(prev => [...prev, form.newChecklistItem.trim()]);
    setForm(f => ({ ...f, newChecklistItem: '' }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: form.title,
        taskType: form.taskType,
        description: form.description || undefined,
        requiredActions: form.requiredActions || undefined,
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate || undefined,
        customerId: form.customerId || undefined,
        dealId: form.dealId || undefined,
        notes: form.notes || undefined,
        checklist: checklistItems.map(t => ({ title: t })),
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {task ? (isRTL ? 'تعديل المهمة' : 'Edit Task') : (isRTL ? 'مهمة جديدة' : 'New Task')}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Task Title *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="What needs to be done?" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Action Type</label>
              <select value={form.taskType} onChange={e => setForm(f => ({ ...f, taskType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{isRTL ? t.labelAr : t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as 'low'|'medium'|'high'|'urgent' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{isRTL ? cfg.labelAr : cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the context and goal of this task..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Required Actions */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-orange-500" /> Required Actions</span>
            </label>
            <textarea rows={2} value={form.requiredActions} onChange={e => setForm(f => ({ ...f, requiredActions: e.target.value }))}
              placeholder="List the specific actions required to complete this task..."
              className="w-full px-3 py-2 border border-orange-200 bg-orange-50 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>

          {/* Due Date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{isRTL ? cfg.labelAr : cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Link to Deal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Link to Customer</label>
              <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">— None —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Link to Deal</label>
              <select value={form.dealId} onChange={e => setForm(f => ({ ...f, dealId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">— None —</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.deal_number} – {d.title}</option>)}
              </select>
            </div>
          </div>

          {/* Checklist / Sub-tasks */}
          {!task && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                <span className="flex items-center gap-1"><ListChecks className="w-3 h-3 text-green-500" /> Sub-tasks (Checklist)</span>
              </label>
              <div className="space-y-1.5 mb-2">
                {checklistItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg text-sm">
                    <CheckSquare className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="flex-1 text-gray-700">{item}</span>
                    <button onClick={() => setChecklistItems(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="text" value={form.newChecklistItem}
                  onChange={e => setForm(f => ({ ...f, newChecklistItem: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addToChecklist()}
                  placeholder="Add a sub-task step..."
                  className="flex-1 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                <button onClick={addToChecklist} className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, isRTL, onOpen, onEdit, onDelete }: {
  task: Task; isRTL: boolean;
  onOpen: (t: Task) => void; onEdit: (t: Task) => void; onDelete: (id: string) => void;
}) {
  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const checklistTotal = Number(task.checklist_total || 0);
  const checklistDone = Number(task.checklist_done || 0);
  const isOverdue = task.due_date && task.status !== 'completed' && task.status !== 'cancelled' && new Date(task.due_date) < new Date();
  const taskTypeCfg = TASK_TYPES.find(t => t.value === task.task_type);

  return (
    <div
      onClick={() => onOpen(task)}
      className={`bg-white border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer group ${
        task.status === 'completed' ? 'border-green-200 opacity-80' :
        isOverdue ? 'border-red-200 bg-red-50/20' : 'border-gray-200 hover:border-blue-200'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusCfg.color}`}>
              <statusCfg.icon className="w-3 h-3" />
              {isRTL ? statusCfg.labelAr : statusCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${priorityCfg.color}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
              {isRTL ? priorityCfg.labelAr : priorityCfg.label}
            </span>
          </div>
          <h3 className={`text-sm font-semibold leading-snug ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {task.title}
          </h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(task)} className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(task.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Type + context */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {taskTypeCfg && (
          <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
            {isRTL ? taskTypeCfg.labelAr : taskTypeCfg.label}
          </span>
        )}
        {task.customer_name && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Building2 className="w-3 h-3" />{task.customer_name}
          </span>
        )}
        {task.deal_number && (
          <span className="text-xs text-blue-500 flex items-center gap-1">
            <Briefcase className="w-3 h-3" />{task.deal_number}
          </span>
        )}
      </div>

      {/* Description snippet */}
      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{task.description}</p>
      )}

      {/* Checklist progress */}
      {checklistTotal > 0 && <ProgressBar done={checklistDone} total={checklistTotal} />}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              <Calendar className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString()}
              {isOverdue && ' ⚠️'}
            </span>
          )}
        </div>
        <button className="text-xs text-blue-500 flex items-center gap-0.5 hover:text-blue-700">
          View <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuth();
  const { isRTL } = useI18n();
  const isAdmin = user?.role === 'Admin';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, statsRes, custRes, dealsRes] = await Promise.all([
        tasksAPI.getAll({ limit: 200 }),
        tasksAPI.getStats(),
        customersAPI.getAll({ limit: 200 }),
        salesAPI.getOpportunities({ limit: 200 }).catch(() => ({ data: { data: [] } })),
      ]);
      setTasks(tasksRes.data?.data || []);
      setStats(statsRes.data);
      setCustomers(custRes.data?.data || []);
      // also try deals API
      try {
        const { dealsAPI: dapi } = await import('@/lib/api');
        const dr = await dapi.getAll({ limit: 200 });
        setDeals(dr.data?.data || []);
      } catch {
        setDeals(dealsRes.data?.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await tasksAPI.create(data);
      await fetchData();
      setShowCreateModal(false);
      showToast('Task created successfully!');
    } catch { showToast('Failed to create task', 'error'); }
  };

  const handleUpdate = async (data: any) => {
    if (!editingTask) return;
    try {
      await tasksAPI.update(editingTask.id, data);
      await fetchData();
      setEditingTask(null);
      showToast('Task updated!');
    } catch { showToast('Failed to update task', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksAPI.delete(id);
      await fetchData();
      setDeletingId(null);
      showToast('Task deleted');
    } catch { showToast('Failed to delete task', 'error'); }
  };

  const updateTaskInList = (updated: Task) => {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (viewingTask?.id === updated.id) setViewingTask(updated);
  };

  // Filter
  const filtered = tasks.filter(t => {
    if (!showCompleted && t.status === 'completed') return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterType && t.task_type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.title.toLowerCase().includes(s) ||
        t.description?.toLowerCase().includes(s) ||
        t.customer_name?.toLowerCase().includes(s) ||
        t.deal_title?.toLowerCase().includes(s);
    }
    return true;
  });

  const grouped: Record<string, Task[]> = { in_progress: [], pending: [], completed: [], cancelled: [] };
  filtered.forEach(t => { if (grouped[t.status]) grouped[t.status].push(t); });

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isRTL ? 'إدارة المهام' : 'Task Management'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isRTL ? 'تتبع مهامك ومتابعة التقدم' : 'Track your tasks, subtasks, and progress'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isRTL ? 'مهمة جديدة' : 'New Task'}
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label:'Total',       labelAr:'الكل',         val: stats.total,       color:'text-gray-700',  bg:'bg-gray-50',    icon: ClipboardList },
              { label:'Pending',     labelAr:'في الانتظار',  val: stats.pending,     color:'text-yellow-700',bg:'bg-yellow-50',  icon: Clock },
              { label:'In Progress', labelAr:'جاري',         val: stats.in_progress, color:'text-blue-700',  bg:'bg-blue-50',    icon: PlayCircle },
              { label:'Completed',   labelAr:'مكتملة',       val: stats.completed,   color:'text-green-700', bg:'bg-green-50',   icon: CheckCircle2 },
              { label:'Overdue',     labelAr:'متأخرة',       val: stats.overdue,     color:'text-red-700',   bg:'bg-red-50',     icon: AlertCircle },
              { label:'Cancelled',   labelAr:'ملغاة',        val: stats.cancelled,   color:'text-gray-500',  bg:'bg-gray-50',    icon: XCircle },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3 border border-white shadow-sm`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{isRTL ? s.labelAr : s.label}</span>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tasks, descriptions, customers..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium ${showCompleted ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              <CheckCircle2 className="w-4 h-4" />
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">All</option>
                  {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">All</option>
                  {Object.entries(PRIORITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                  <option value="">All</option>
                  {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Task List grouped by status */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-500 mb-1">No tasks found</h3>
            <p className="text-sm text-gray-400 mb-4">Create your first task to get started</p>
            <button onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> New Task
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {(['in_progress', 'pending', 'completed', 'cancelled'] as const).map(statusGroup => {
              const group = grouped[statusGroup];
              if (group.length === 0) return null;
              const cfg = STATUS_CONFIG[statusGroup];
              return (
                <div key={statusGroup}>
                  <div className="flex items-center gap-2 mb-3">
                    <cfg.icon className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-700">{isRTL ? cfg.labelAr : cfg.label}</h3>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{group.length}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.map(task => (
                      <TaskCard key={task.id} task={task} isRTL={isRTL}
                        onOpen={t => setViewingTask(t)}
                        onEdit={t => setEditingTask(t)}
                        onDelete={id => setDeletingId(id)}
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
          <TaskFormModal customers={customers} deals={deals} isAdmin={isAdmin} isRTL={isRTL}
            onSave={handleCreate} onClose={() => setShowCreateModal(false)} />
        )}
        {editingTask && (
          <TaskFormModal task={editingTask} customers={customers} deals={deals} isAdmin={isAdmin} isRTL={isRTL}
            onSave={handleUpdate} onClose={() => setEditingTask(null)} />
        )}
        {viewingTask && (
          <TaskDetailModal task={viewingTask} isRTL={isRTL}
            onClose={() => setViewingTask(null)}
            onUpdate={updateTaskInList} />
        )}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Task?</h3>
              <p className="text-sm text-gray-500 mb-5">This action cannot be undone.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setDeletingId(null)} className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={() => handleDelete(deletingId)} className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
