'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { salesAPI, tasksAPI, customersAPI } from '@/lib/api';
import { Loading } from '@/components/ui';
import {
  ArrowLeft, DollarSign, Calendar, Globe, Edit2, Check, X,
  Phone, Mail, MessageSquare, Clock, Plus, ChevronRight,
  CheckCircle, XCircle, Target, AlertTriangle, Briefcase,
  Activity, FileText, Users, Package, TrendingUp, Save,
  MoreVertical, Star
} from 'lucide-react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type AnyRecord = Record<string, unknown>;

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  outcome?: string;
  created_at: string;
  user_name?: string;
}

// ─── Stage Config ──────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'lead',        label: 'Lead',        color: '#94a3b8', bg: 'bg-gray-100',    text: 'text-gray-700',    border: 'border-gray-300'    },
  { key: 'contacted',   label: 'Contacted',   color: '#3b82f6', bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300'    },
  { key: 'quotation',   label: 'Quotation',   color: '#f59e0b', bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-300'  },
  { key: 'negotiation', label: 'Negotiation', color: '#f97316', bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300'  },
  { key: 'won',         label: 'Won',         color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  { key: 'lost',        label: 'Lost',        color: '#ef4444', bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-300'     },
];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call:         <Phone     className="w-4 h-4" />,
  email:        <Mail      className="w-4 h-4" />,
  meeting:      <Users     className="w-4 h-4" />,
  note:         <MessageSquare className="w-4 h-4" />,
  stage_change: <TrendingUp className="w-4 h-4" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-blue-100 text-blue-600', email: 'bg-purple-100 text-purple-600',
  meeting: 'bg-orange-100 text-orange-600', note: 'bg-gray-100 text-gray-600',
  stage_change: 'bg-emerald-100 text-emerald-600',
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
          {t.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => remove(t.id)}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
        </div>
      ))}
    </div>
  );
}

export default function SalesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [opp, setOpp] = useState<AnyRecord | null>(null);
  const [tasks, setTasks] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'tasks' | 'notes'>('overview');
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

  const addToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const tid = Date.now().toString();
    setToasts(prev => [...prev, { id: tid, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppRes, tasksRes] = await Promise.allSettled([
        salesAPI.getOpportunity(id),
        tasksAPI.getAll({ dealId: id, limit: 50 }),
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
  const activities = (opp.activities as Activity[]) || [];
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const overdueTasks  = tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date as string) < new Date()).length;

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* ── Back + Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg mt-0.5">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              {editing ? (
                <input className="text-xl font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent focus:outline-none w-full max-w-xl" value={editForm.title as string} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
              ) : (
                <h1 className="text-xl font-bold text-gray-900">{opp.title as string}</h1>
              )}
              <div className="flex items-center gap-3 mt-1">
                <Link href={`/customers/${opp.customer_id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />{opp.customer_name as string}
                </Link>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">Updated {opp.updated_at ? formatDistanceToNow(new Date(opp.updated_at as string), { addSuffix: true }) : '—'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"><X className="w-4 h-4" />Cancel</button>
                <button onClick={handleSaveEdit} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"><Save className="w-4 h-4" />Save</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"><Edit2 className="w-4 h-4" />Edit</button>
                {opp.stage !== 'won' && opp.stage !== 'lost' && (
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
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Deal Stage Progress</h2>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${currentStage.bg} ${currentStage.text}`}>
              {currentStage.label}
            </span>
          </div>
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200">
              <div
                className="h-full transition-all duration-500"
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
                const isClickable = !['won', 'lost'].includes(opp.stage as string) && !['won', 'lost'].includes(stage.key);
                return (
                  <button
                    key={stage.key}
                    disabled={!isClickable || isCurrent || movingStage}
                    onClick={() => isClickable && !isCurrent ? handleMoveStage(stage.key) : undefined}
                    className={`flex flex-col items-center gap-1.5 group ${isClickable && !isCurrent ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all z-10 relative
                      ${isCurrent
                        ? `border-[${stage.color}] bg-[${stage.color}] text-white scale-110 shadow-md`
                        : isPassed
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-300 bg-white text-gray-400 hover:border-blue-400'
                      }`}
                      style={{
                        borderColor: isCurrent ? stage.color : isPassed ? '#3b82f6' : undefined,
                        backgroundColor: isCurrent ? stage.color : isPassed ? '#3b82f6' : undefined,
                        color: (isCurrent || isPassed) ? 'white' : undefined,
                      }}
                    >
                      {isPassed ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                    </div>
                    <span className={`text-xs font-medium transition-colors ${isCurrent ? 'text-gray-900 font-semibold' : isPassed ? 'text-blue-600' : 'text-gray-400'}`}>
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
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {([
            { id: 'overview',   label: 'Overview',   icon: Briefcase },
            { id: 'activities', label: 'Activities',  icon: Activity },
            { id: 'tasks',      label: `Tasks (${tasks.length})`, icon: CheckSquare2 },
            { id: 'notes',      label: 'Notes',      icon: FileText },
          ] as { id: typeof activeTab; label: string; icon: React.ElementType }[]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deal Info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-600" />Deal Details</h3>
              {[
                { label: 'Service Type', field: 'serviceType', dbField: 'service_type', placeholder: 'FCL, LCL, Air Express...' },
                { label: 'Shipping Mode', field: 'shippingMode', dbField: 'shipping_mode', placeholder: 'sea, air, road...' },
                { label: 'Origin Country', field: 'originCountry', dbField: 'origin_country', placeholder: 'China' },
                { label: 'Destination', field: 'destinationCountry', dbField: 'destination_country', placeholder: 'USA' },
                { label: 'Cargo Type', field: 'cargoType', dbField: 'cargo_type', placeholder: 'General, Hazmat...' },
              ].map(({ label, field, dbField, placeholder }) => (
                <div key={field} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">{label}</span>
                  {editing ? (
                    <input className="text-sm font-medium text-gray-900 text-right border-b border-gray-300 focus:outline-none" value={editForm[field] as string || ''} onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} placeholder={placeholder} />
                  ) : (
                    <span className="text-sm font-medium text-gray-900">{(opp[dbField] as string) || '—'}</span>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">Assigned To</span>
                <span className="text-sm font-medium text-gray-900">{(opp.assigned_to_name as string) || '—'}</span>
              </div>
            </div>

            {/* Customer + Route */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-blue-600" />Customer</h3>
                <Link href={`/customers/${opp.customer_id}`} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                    {(opp.customer_name as string || 'C').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{opp.customer_name as string}</p>
                    <p className="text-xs text-gray-500">{opp.customer_country as string || 'N/A'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
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

        {/* ══ ACTIVITIES TAB ══ */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
              <button onClick={() => setShowActivityForm(!showActivityForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />Log Activity
              </button>
            </div>

            {showActivityForm && (
              <form onSubmit={handleAddActivity} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Activity Type</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" value={activityForm.type} onChange={e => setActivityForm({ ...activityForm, type: e.target.value })}>
                      {['call', 'email', 'meeting', 'note', 'stage_change'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}
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
              {activities.length === 0 && !showActivityForm && (
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-700 capitalize">{act.activity_type.replace('_', ' ')}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {act.created_at ? formatDistanceToNow(new Date(act.created_at), { addSuffix: true }) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{act.description}</p>
                    {act.outcome && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400" />Outcome: {act.outcome}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ TASKS TAB ══ */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Tasks <span className="text-sm font-normal text-gray-400">({completedTasks}/{tasks.length} done)</span>
                {overdueTasks > 0 && <span className="text-xs text-red-500 ml-2 flex items-center gap-0.5 inline-flex"><AlertTriangle className="w-3 h-3" />{overdueTasks} overdue</span>}
              </h3>
              <button onClick={() => setShowTaskForm(!showTaskForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />Add Task
              </button>
            </div>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
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

            {/* Task progress */}
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
                const isOverdue = task.due_date && new Date(task.due_date as string) < new Date() && task.status !== 'completed';
                return (
                  <div key={task.id as string} className={`bg-white rounded-xl border p-4 flex items-start gap-3 shadow-sm ${isOverdue ? 'border-orange-200' : 'border-gray-100'}`}>
                    <button
                      onClick={() => task.status !== 'completed' ? handleCompleteTask(task.id as string) : undefined}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${task.status === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-400'}`}
                    >
                      {task.status === 'completed' && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {task.title as string}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${task.priority === 'urgent' ? 'bg-red-100 text-red-600' : task.priority === 'high' ? 'bg-orange-100 text-orange-600' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                          {task.priority as string}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400 capitalize">{(task.task_type as string || '').replace(/_/g, ' ')}</span>
                        {task.due_date && (
                          <span className={`text-xs flex items-center gap-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                            <Clock className="w-3 h-3" />
                            {format(new Date(task.due_date as string), 'MMM d')}
                            {isOverdue && ' (overdue)'}
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
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{opp.notes as string}</p>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No notes yet</p>
                    <button onClick={() => setEditing(true)} className="text-blue-600 hover:underline text-sm mt-1">Add notes →</button>
                  </div>
                )}
              </div>
            )}
            {opp.loss_reason && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700">Loss Reason</p>
                <p className="text-sm text-red-600 mt-0.5">{opp.loss_reason as string}</p>
              </div>
            )}
          </div>
        )}

        <Toasts list={toasts} remove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      </div>
    </MainLayout>
  );
}

// Missing icon reference fix
function CheckSquare2({ className }: { className?: string }) {
  return <CheckCircle className={className} />;
}
