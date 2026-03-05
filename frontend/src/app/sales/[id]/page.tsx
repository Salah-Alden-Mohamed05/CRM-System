'use client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { salesAPI, aiAPI } from '@/lib/api';
import { Loading, Badge, Card } from '@/components/ui';
import {
  ArrowLeft, TrendingUp, DollarSign, Calendar, User, MapPin,
  ChevronRight, Brain, CheckCircle, AlertTriangle, Plus, Target,
  MessageSquare, Edit2, Package
} from 'lucide-react';
import { format } from 'date-fns';

const stages = ['lead', 'contacted', 'quotation', 'negotiation', 'won', 'lost'];
const stageColors: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  quotation: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const activityTypeIcons: Record<string, React.ReactNode> = {
  call: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" /></svg>,
  email: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  meeting: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  note: <MessageSquare className="w-4 h-4" />,
};

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [opportunity, setOpportunity] = useState<AnyRecord | null>(null);
  const [aiScore, setAiScore] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call', description: '', outcome: '' });
  const [selectedStage, setSelectedStage] = useState('');
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [oppRes, aiRes] = await Promise.allSettled([
        salesAPI.getOpportunity(id),
        aiAPI.scoreDeal(id),
      ]);
      if (oppRes.status === 'fulfilled') {
        const opp = oppRes.value.data.data;
        setOpportunity(opp);
        setSelectedStage(opp.stage);
        setEditForm({
          title: opp.title || '',
          value: opp.value || 0,
          probability: opp.probability || 50,
          expected_close_date: opp.expected_close_date ? opp.expected_close_date.split('T')[0] : '',
          shipping_mode: opp.shipping_mode || '',
          origin_country: opp.origin_country || '',
          destination_country: opp.destination_country || '',
          notes: opp.notes || '',
        });
      }
      if (aiRes.status === 'fulfilled') setAiScore(aiRes.value.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStageUpdate = async () => {
    try {
      await salesAPI.updateStage(id, { stage: selectedStage });
      setShowStageModal(false);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddActivity = async () => {
    try {
      await salesAPI.addActivity(id, activityForm);
      setShowActivityModal(false);
      setActivityForm({ type: 'call', description: '', outcome: '' });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = async () => {
    try {
      await salesAPI.updateOpportunity(id, editForm);
      setShowEditModal(false);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <MainLayout>
      <div className="flex items-center justify-center h-64"><Loading /></div>
    </MainLayout>
  );

  if (!opportunity) return (
    <MainLayout>
      <div className="text-center py-16 text-gray-500">Opportunity not found</div>
    </MainLayout>
  );

  const activities = (opportunity.activities as AnyRecord[]) || [];
  const currentStageIdx = stages.indexOf(String(opportunity.stage || ''));
  const weightedValue = Number(opportunity.value || 0) * (Number(opportunity.probability || 0) / 100);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => router.push('/sales')} className="p-2 hover:bg-gray-100 rounded-lg mt-1">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{String(opportunity.title || '')}</h1>
                <Badge className={stageColors[String(opportunity.stage || '')] || ''}>
                  {String(opportunity.stage || '')}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                {opportunity.customer_name && (
                  <span
                    className="flex items-center gap-1 text-blue-600 cursor-pointer hover:underline"
                    onClick={() => router.push(`/customers/${opportunity.customer_id}`)}
                  >
                    <User className="w-4 h-4" />
                    {String(opportunity.customer_name)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  ${Number(opportunity.value || 0).toLocaleString()}
                </span>
                {opportunity.shipping_mode && (
                  <span className="flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    {String(opportunity.shipping_mode)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </button>
            <button
              onClick={() => setShowStageModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <ChevronRight className="w-4 h-4" /> Move Stage
            </button>
          </div>
        </div>

        {/* Stage Progress */}
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Stage Progress</h3>
          <div className="flex items-center gap-2">
            {stages.filter(s => s !== 'lost').map((stage, idx) => {
              const active = stage === opportunity.stage;
              const completed = idx < currentStageIdx && opportunity.stage !== 'lost';
              return (
                <div key={stage} className="flex items-center flex-1">
                  <div className={`flex-1 h-2 rounded-full transition-colors ${
                    completed ? 'bg-green-400' : active ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                  {idx === 0 && (
                    <div className={`w-3 h-3 rounded-full -ml-1 flex-shrink-0 ${completed || active ? 'bg-blue-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            {stages.filter(s => s !== 'lost').map(stage => (
              <span key={stage} className={`text-xs capitalize ${
                stage === opportunity.stage ? 'text-blue-600 font-medium' :
                stages.indexOf(stage) < currentStageIdx ? 'text-green-600' : 'text-gray-400'
              }`}>
                {stage}
              </span>
            ))}
          </div>
          {String(opportunity.stage) === 'lost' && (
            <p className="mt-2 text-sm text-red-500 font-medium">Deal Lost</p>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Details */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Opportunity Details</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Deal Value', value: `$${Number(opportunity.value || 0).toLocaleString()}`, icon: DollarSign },
                  { label: 'Weighted Value', value: `$${weightedValue.toLocaleString()}`, icon: Target },
                  { label: 'Probability', value: `${opportunity.probability}%`, icon: TrendingUp },
                  { label: 'Close Date', value: opportunity.expected_close_date ? format(new Date(String(opportunity.expected_close_date)), 'dd MMM yyyy') : null, icon: Calendar },
                  { label: 'Origin', value: opportunity.origin_country, icon: MapPin },
                  { label: 'Destination', value: opportunity.destination_country, icon: MapPin },
                  { label: 'Mode', value: opportunity.shipping_mode, icon: Package },
                  { label: 'Assigned To', value: opportunity.assigned_to_name, icon: User },
                ].filter(item => item.value).map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start gap-2">
                    <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-medium text-gray-900">{String(value)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {opportunity.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{String(opportunity.notes)}</p>
                </div>
              )}
            </Card>

            {/* Activity Log */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Activity Log ({activities.length})</h3>
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-3 h-3" /> Add Activity
                </button>
              </div>
              <div className="space-y-3">
                {activities.map((act) => {
                  const a = act as AnyRecord;
                  return (
                    <div key={String(a.id)} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600">
                        {activityTypeIcons[String(a.type || 'note')] || <MessageSquare className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 capitalize">{String(a.type || '')}</p>
                          <p className="text-xs text-gray-400">
                            {a.created_at ? format(new Date(String(a.created_at)), 'dd MMM yyyy') : ''}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{String(a.description || '')}</p>
                        {a.outcome && (
                          <p className="text-xs text-green-600 mt-1">Outcome: {String(a.outcome)}</p>
                        )}
                        <p className="text-xs text-gray-400">{String(a.created_by_name || '')}</p>
                      </div>
                    </div>
                  );
                })}
                {activities.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No activities recorded yet</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* AI Score */}
            {aiScore && (
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">AI Deal Score</h3>
                </div>
                <div className="text-center mb-4">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ${
                    Number(aiScore.score) >= 70 ? 'bg-green-100 text-green-700' :
                    Number(aiScore.score) >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {Number(aiScore.score)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">out of 100</p>
                </div>
                {(aiScore.strengths as string[])?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Strengths</p>
                    {(aiScore.strengths as string[]).map((s, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-green-700 mb-1">
                        <CheckCircle className="w-3 h-3 flex-shrink-0" />
                        {s}
                      </div>
                    ))}
                  </div>
                )}
                {(aiScore.risks as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">Risks</p>
                    {(aiScore.risks as string[]).map((r, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs text-red-600 mb-1">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        {r}
                      </div>
                    ))}
                  </div>
                )}
                {aiScore.recommendation && (
                  <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
                    {String(aiScore.recommendation)}
                  </div>
                )}
              </Card>
            )}

            {/* Quick Stats */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Deal Value</span>
                  <span className="font-bold text-gray-900">${Number(opportunity.value || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Probability</span>
                  <span className="font-bold text-gray-900">{String(opportunity.probability)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Weighted</span>
                  <span className="font-bold text-blue-600">${weightedValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Activities</span>
                  <span className="font-bold text-gray-900">{activities.length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Stage Modal */}
      {showStageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-base font-semibold">Move to Stage</h2>
            </div>
            <div className="p-5 space-y-2">
              {stages.map(stage => (
                <button
                  key={stage}
                  onClick={() => setSelectedStage(stage)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm capitalize transition-colors ${
                    selectedStage === stage
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {stage}
                  {stage === opportunity.stage && (
                    <span className="ml-2 text-xs opacity-70">(current)</span>
                  )}
                </button>
              ))}
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => setShowStageModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleStageUpdate} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-base font-semibold">Log Activity</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={activityForm.type}
                  onChange={e => setActivityForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {['call', 'email', 'meeting', 'note', 'task'].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={activityForm.description}
                  onChange={e => setActivityForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="What happened?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
                <input
                  value={activityForm.outcome}
                  onChange={e => setActivityForm(prev => ({ ...prev, outcome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Result or next steps..."
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => setShowActivityModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleAddActivity} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Log Activity</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-base font-semibold">Edit Opportunity</h2>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: 'title', label: 'Title', type: 'text' },
                { key: 'value', label: 'Deal Value ($)', type: 'number' },
                { key: 'probability', label: 'Probability (%)', type: 'number' },
                { key: 'expected_close_date', label: 'Expected Close Date', type: 'date' },
                { key: 'shipping_mode', label: 'Shipping Mode', type: 'text' },
                { key: 'origin_country', label: 'Origin Country', type: 'text' },
                { key: 'destination_country', label: 'Destination Country', type: 'text' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={String(editForm[key] || '')}
                    onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={String(editForm.notes || '')}
                  onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleEdit} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
