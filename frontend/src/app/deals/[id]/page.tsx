'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { dealsAPI, rfqsAPI, quotationsAPI, tasksAPI, documentsAPI, customersAPI } from '@/lib/api';
import {
  ArrowLeft, RefreshCw, Building2, Globe, Ship, Plane, Package, Edit3,
  FileText, CheckSquare, MessageSquare, Upload, Download, Eye, Trash2,
  ChevronRight, Plus, X, CheckCircle2, AlertCircle, DollarSign, Calendar,
  BarChart2, TrendingUp, Target, Activity, ClipboardList, Paperclip,
  Phone, Mail, User, Tag, Move, ExternalLink
} from 'lucide-react';
import { dealsAPI as dAPI } from '@/lib/api';

type Tab = 'overview' | 'activities' | 'rfqs' | 'quotations' | 'tasks' | 'documents';

const STAGES = ['lead','contacted','rfq','quotation','negotiation','won','lost'];
const STAGE_LABELS: Record<string,string> = {
  lead:'Lead', contacted:'Contacted', rfq:'RFQ', quotation:'Quotation',
  negotiation:'Negotiation', won:'Won', lost:'Lost'
};
const STAGE_COLORS: Record<string,string> = {
  lead:'bg-slate-100 text-slate-700', contacted:'bg-blue-100 text-blue-700',
  rfq:'bg-violet-100 text-violet-700', quotation:'bg-amber-100 text-amber-700',
  negotiation:'bg-orange-100 text-orange-700', won:'bg-green-100 text-green-700',
  lost:'bg-red-100 text-red-700',
};

// Document Upload Component
function DocUploadPanel({ dealId, rfqId, quotationId, onUploaded }: {
  dealId?: string; rfqId?: string; quotationId?: string; onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('other');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  const DOC_CATEGORIES = [
    'quotation','contract','invoice','bill_of_lading','customs',
    'packing_list','insurance','certificate','purchase_order','rfq','other'
  ];

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || file.name);
      fd.append('documentCategory', category);
      fd.append('description', description);
      if (dealId) fd.append('dealId', dealId);
      if (rfqId) fd.append('rfqId', rfqId);
      if (quotationId) fd.append('quotationId', quotationId);
      await documentsAPI.upload(fd);
      setFile(null); setName(''); setDescription('');
      onUploaded();
    } catch (e) { console.error(e); } finally { setUploading(false); }
  };

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50">
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        onClick={() => document.getElementById('doc-upload')?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all mb-3 ${drag ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50/30'}`}
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          {file ? <span className="font-semibold text-blue-600">{file.name}</span> : 'Drop PDF, image, or document here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images — max 20MB</p>
        <input id="doc-upload" type="file" className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.csv"
          onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
      </div>
      {file && (
        <div className="space-y-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Document name (optional)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
            </select>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Description" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
          <button onClick={handleUpload} disabled={uploading}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = ['Admin', 'Finance', 'Operations'].includes(user?.role || '');

  const [deal, setDeal] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [activityText, setActivityText] = useState('');
  const [activityType, setActivityType] = useState('note');
  const [activityOutcome, setActivityOutcome] = useState('');
  const [addingActivity, setAddingActivity] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchDeal = useCallback(async () => {
    try {
      const res = await dealsAPI.getOne(id);
      setDeal(res.data?.data);
      // Fetch docs + tasks linked to this deal
      const [docsRes, tasksRes] = await Promise.all([
        documentsAPI.getAll({ dealId: id }),
        tasksAPI.getAll({ dealId: id, limit: 100 }).catch(() => ({ data: { data: [] } })),
      ]);
      setDocuments(docsRes.data?.data || []);
      setTasks(tasksRes.data?.data || []);
    } catch (e) { console.error(e); }
  }, [id]);

  useEffect(() => { setLoading(true); fetchDeal().finally(() => setLoading(false)); }, [fetchDeal]);

  const addActivity = async () => {
    if (!activityText.trim()) return;
    setAddingActivity(true);
    try {
      await dealsAPI.addActivity(id, { activityType, description: activityText, outcome: activityOutcome || undefined });
      setActivityText(''); setActivityOutcome('');
      await fetchDeal();
      showToast('Activity logged!');
    } catch { showToast('Failed', 'error'); } finally { setAddingActivity(false); }
  };

  const addQuickTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      await tasksAPI.create({ title: newTaskTitle, taskType: 'follow_up', dealId: id, customerId: deal?.customer_id, priority: 'medium' });
      setNewTaskTitle('');
      await fetchDeal();
      showToast('Task added!');
    } catch { showToast('Failed', 'error'); } finally { setAddingTask(false); }
  };

  const moveStage = async (newStage: string) => {
    try {
      await dealsAPI.updateStage(id, { stage: newStage });
      await fetchDeal();
      showToast(`Moved to ${STAGE_LABELS[newStage]}`);
    } catch { showToast('Failed', 'error'); }
  };

  if (loading) return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    </MainLayout>
  );

  if (!deal) return (
    <MainLayout>
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-600">Deal not found</h2>
        <button onClick={() => router.push('/deals')} className="mt-4 text-blue-600 text-sm hover:underline">← Back to Deals</button>
      </div>
    </MainLayout>
  );

  const activities = deal.activities as any[] || [];
  const rfqs = deal.rfqs as any[] || [];
  const quotations = deal.quotations as any[] || [];
  const stageColor = STAGE_COLORS[deal.stage] || 'bg-gray-100 text-gray-700';

  const tabs: { key: Tab; label: string; count?: number; icon: any }[] = [
    { key: 'overview',    label: 'Overview',    icon: BarChart2 },
    { key: 'activities',  label: 'Activity',    count: activities.length, icon: Activity },
    { key: 'rfqs',        label: 'RFQs',        count: rfqs.length,       icon: FileText },
    { key: 'quotations',  label: 'Quotations',  count: quotations.length, icon: CheckSquare },
    { key: 'tasks',       label: 'Tasks',       count: tasks.length,      icon: ClipboardList },
    { key: 'documents',   label: 'Documents',   count: documents.length,  icon: Paperclip },
  ];

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* Back + Header */}
        <div>
          <button onClick={() => router.push('/deals')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Deals
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-mono text-gray-400">{deal.deal_number}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${stageColor}`}>
                  {STAGE_LABELS[deal.stage]}
                </span>
                {deal.value > 0 && (
                  <span className="text-sm font-bold text-gray-700">
                    {deal.currency} {Number(deal.value).toLocaleString()}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{deal.customer_name}</span>
                {deal.assigned_to_name && <span className="flex items-center gap-1"><User className="w-4 h-4" />{deal.assigned_to_name}</span>}
                {deal.shipping_mode && <span className="flex items-center gap-1"><Ship className="w-4 h-4" />{deal.shipping_mode}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push(`/deals/${id}?edit=1`)}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            </div>
          </div>
        </div>

        {/* Stage Pipeline Progress */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-1">
            {STAGES.map((stage, i) => {
              const idx = STAGES.indexOf(deal.stage);
              const isCurrent = stage === deal.stage;
              const isPast = i < idx;
              const isWon = deal.stage === 'won';
              const isLost = deal.stage === 'lost';
              return (
                <React.Fragment key={stage}>
                  <button
                    onClick={() => moveStage(stage)}
                    className={`flex-1 py-2 px-1 rounded-lg text-xs font-semibold text-center transition-all ${
                      isCurrent
                        ? isWon ? 'bg-green-500 text-white' : isLost ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                        : isPast ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={`Move to ${STAGE_LABELS[stage]}`}
                  >
                    {STAGE_LABELS[stage]}
                  </button>
                  {i < STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.key ? 'border-blue-500 text-blue-600 bg-blue-50/30' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* ── Overview Tab ─────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Value',       val: `${deal.currency} ${Number(deal.value||0).toLocaleString()}`, icon: DollarSign, color: 'text-blue-600' },
                    { label: 'Probability', val: `${deal.probability}%`,                                       icon: Target,     color: 'text-purple-600' },
                    { label: 'Close Date',  val: deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '—', icon: Calendar, color: 'text-orange-600' },
                    { label: 'Activities',  val: activities.length,                                             icon: Activity,   color: 'text-green-600' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">{s.label}</span>
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                      </div>
                      <div className="text-xl font-bold text-gray-800">{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Deal Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {[
                    { label: 'Service Type',  val: deal.service_type },
                    { label: 'Shipping Mode', val: deal.shipping_mode },
                    { label: 'Incoterms',     val: deal.incoterms },
                    { label: 'Origin',        val: deal.origin_country || deal.origin_port ? `${deal.origin_country || ''} ${deal.origin_port ? `· ${deal.origin_port}` : ''}`.trim() : undefined },
                    { label: 'Destination',   val: deal.destination_country || deal.destination_port ? `${deal.destination_country || ''} ${deal.destination_port ? `· ${deal.destination_port}` : ''}`.trim() : undefined },
                    { label: 'Cargo Type',    val: deal.cargo_type },
                  ].filter(f => f.val).map(f => (
                    <div key={f.label}>
                      <span className="block text-xs text-gray-400 mb-0.5">{f.label}</span>
                      <span className="font-medium text-gray-800">{f.val}</span>
                    </div>
                  ))}
                </div>

                {deal.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-2">Notes</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{deal.notes}</p>
                  </div>
                )}

                {deal.loss_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-red-700 mb-1">Loss Reason</h4>
                    <p className="text-sm text-red-600">{deal.loss_reason}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Activities Tab ────────────────────────────────────── */}
            {activeTab === 'activities' && (
              <div className="space-y-4">
                {/* Add Activity */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Log Activity</h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select value={activityType} onChange={e => setActivityType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      {['call','email','meeting','note','follow_up','other'].map(t =>
                        <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                    <input type="text" value={activityOutcome} onChange={e => setActivityOutcome(e.target.value)}
                      placeholder="Outcome (optional)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <textarea rows={2} value={activityText} onChange={e => setActivityText(e.target.value)}
                    placeholder="What happened? Add notes, outcomes, next steps..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none mb-2" />
                  <button onClick={addActivity} disabled={addingActivity || !activityText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                    {addingActivity ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Log Activity
                  </button>
                </div>

                {/* Activity Timeline */}
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No activities yet.</p>
                  ) : activities.map((a: any) => (
                    <div key={a.id} className="flex gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-200">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">
                            {(a.activity_type || 'note').replace('_',' ')}
                          </span>
                          {a.new_stage && (
                            <span className="text-xs text-gray-400">
                              {a.old_stage} → {a.new_stage}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 ml-auto">
                            {new Date(a.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{a.description}</p>
                        {a.outcome && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {a.outcome}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── RFQs Tab ────────────────────────────────────────────── */}
            {activeTab === 'rfqs' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-gray-700">{rfqs.length} RFQ(s)</h4>
                  <button onClick={() => router.push(`/rfqs?dealId=${id}`)}
                    className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700">
                    <Plus className="w-4 h-4" /> New RFQ
                  </button>
                </div>
                {rfqs.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No RFQs submitted yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Move to RFQ stage and submit a request for quotation.</p>
                  </div>
                ) : rfqs.map((rfq: any) => (
                  <div key={rfq.id} className="border border-gray-200 rounded-xl p-4 hover:border-violet-200 hover:bg-violet-50/30 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono text-gray-400">{rfq.rfq_number}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            rfq.status === 'quoted' ? 'bg-green-100 text-green-700' :
                            rfq.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                          }`}>{rfq.status}</span>
                          {rfq.shipping_mode && <span className="text-xs text-gray-500">{rfq.shipping_mode}</span>}
                        </div>
                      </div>
                      <button onClick={() => router.push(`/rfqs/${rfq.id}`)}
                        className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-600">
                      <div><span className="text-gray-400">Origin:</span> {rfq.origin_country} · {rfq.origin_port}</div>
                      <div><span className="text-gray-400">Destination:</span> {rfq.destination_country} · {rfq.destination_port}</div>
                      {rfq.weight_kg && <div><span className="text-gray-400">Weight:</span> {rfq.weight_kg} kg</div>}
                      {rfq.volume_cbm && <div><span className="text-gray-400">Volume:</span> {rfq.volume_cbm} CBM</div>}
                    </div>
                    {rfq.special_instructions && (
                      <p className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">{rfq.special_instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Quotations Tab ─────────────────────────────────────── */}
            {activeTab === 'quotations' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-gray-700">{quotations.length} Quotation(s)</h4>
                  {['Admin','Finance','Operations'].includes(user?.role || '') && (
                    <button onClick={() => router.push(`/quotations?dealId=${id}`)}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700">
                      <Plus className="w-4 h-4" /> Create Quotation
                    </button>
                  )}
                </div>
                {quotations.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <CheckSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No quotations yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Finance/Operations will create a quotation after RFQ review.</p>
                  </div>
                ) : quotations.map((q: any) => (
                  <div key={q.id} className="border border-gray-200 rounded-xl p-4 hover:border-amber-200 hover:bg-amber-50/30 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono text-gray-400">{q.quotation_number}</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            q.status === 'accepted' ? 'bg-green-100 text-green-700' :
                            q.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            q.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                          }`}>{q.status}</span>
                          <span className="text-sm font-bold text-gray-800">
                            {q.currency} {Number(q.total_amount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => router.push(`/quotations/${q.id}`)}
                        className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                        View <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                      <div><span className="text-gray-400">Freight:</span> <span className="font-medium">{q.currency} {Number(q.freight_cost||0).toLocaleString()}</span></div>
                      <div><span className="text-gray-400">Subtotal:</span> <span className="font-medium">{q.currency} {Number(q.subtotal||0).toLocaleString()}</span></div>
                      <div><span className="text-gray-400">Valid Until:</span> <span className="font-medium">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tasks Tab ─────────────────────────────────────────── */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addQuickTask()}
                    placeholder="Quick add task (press Enter)..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  <button onClick={addQuickTask} disabled={addingTask || !newTaskTitle.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => router.push(`/tasks?dealId=${id}`)}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                    Full Tasks
                  </button>
                </div>
                {tasks.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                    <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No tasks linked to this deal.</p>
                  </div>
                ) : tasks.map((task: any) => {
                  const checklistDone = Number(task.checklist_done || 0);
                  const checklistTotal = Number(task.checklist_total || 0);
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-200">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        task.status === 'completed' ? 'bg-green-500' :
                        task.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {task.title}
                          </span>
                          <div className="flex items-center gap-1 text-xs">
                            {task.priority === 'high' || task.priority === 'urgent' ? (
                              <span className="text-red-500">{task.priority}</span>
                            ) : null}
                            {task.due_date && (
                              <span className="text-gray-400">{new Date(task.due_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        {checklistTotal > 0 && (
                          <div className="mt-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all"
                                  style={{ width: `${Math.round((checklistDone/checklistTotal)*100)}%` }} />
                              </div>
                              <span className="text-xs text-gray-400">{checklistDone}/{checklistTotal}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Documents Tab ─────────────────────────────────────── */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                <DocUploadPanel dealId={id} onUploaded={() => { fetchDeal(); showToast('Document uploaded!'); }} />

                {documents.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                    <Paperclip className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No documents attached yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-200 group">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          doc.file_type === 'pdf' ? 'bg-red-100' :
                          doc.file_type === 'image' ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <FileText className={`w-5 h-5 ${doc.file_type === 'pdf' ? 'text-red-500' : doc.file_type === 'image' ? 'text-blue-500' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                          <p className="text-xs text-gray-400">
                            {doc.document_category?.replace('_',' ')} · {doc.uploaded_by_name} · {new Date(doc.created_at).toLocaleDateString()}
                            {doc.file_size && ` · ${(doc.file_size/1024).toFixed(0)} KB`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.file_type === 'pdf' && (
                            <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api','') || 'http://localhost:5000'}${doc.file_url}`} target="_blank" rel="noreferrer"
                              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded" title="Preview">
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api','') || 'http://localhost:5000'}/api/documents/${doc.id}/download`}
                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded" title="Download">
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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
