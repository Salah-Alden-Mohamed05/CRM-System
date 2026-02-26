'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { salesAPI, customersAPI } from '@/lib/api';
import { Opportunity, Customer } from '@/types';
import { Card, Badge, Button, Input, Select, Modal, Loading, EmptyState } from '@/components/ui';
import { TrendingUp, Plus, DollarSign, ChevronRight, Target, Calendar } from 'lucide-react';

const STAGES = [
  { key: 'lead', label: 'Lead', color: 'bg-gray-100 border-gray-300 text-gray-700', dot: 'bg-gray-400' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-50 border-blue-300 text-blue-700', dot: 'bg-blue-400' },
  { key: 'quotation', label: 'Quotation', color: 'bg-yellow-50 border-yellow-300 text-yellow-700', dot: 'bg-yellow-400' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-orange-50 border-orange-300 text-orange-700', dot: 'bg-orange-400' },
  { key: 'won', label: 'Won', color: 'bg-green-50 border-green-300 text-green-700', dot: 'bg-green-500' },
  { key: 'lost', label: 'Lost', color: 'bg-red-50 border-red-300 text-red-700', dot: 'bg-red-400' },
];

const stageBadge: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'purple'> = {
  lead: 'default', contacted: 'info', quotation: 'warning', negotiation: 'purple', won: 'success', lost: 'danger',
};

export default function SalesPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Record<string, Opportunity[]>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '', customerId: '', stage: 'lead', value: '',
    probability: '', expectedCloseDate: '', serviceType: '',
    originCountry: '', destinationCountry: '', shippingMode: '', notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppRes, custRes] = await Promise.all([
        salesAPI.getOpportunities({ limit: 200 }),
        customersAPI.getAll({ limit: 100 }),
      ]);

      // Build pipeline map
      const pipeline: Record<string, Opportunity[]> = {
        lead: [], contacted: [], quotation: [], negotiation: [], won: [], lost: [],
      };
      oppRes.data.data.forEach((opp: Opportunity) => {
        if (pipeline[opp.stage]) pipeline[opp.stage].push(opp);
      });
      setOpportunities(pipeline);
      setCustomers(custRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    fetchData();
  }, [isAuthenticated, router, fetchData]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await salesAPI.createOpportunity(formData);
      setShowModal(false);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const moveStage = async (opp: Opportunity, newStage: string) => {
    try {
      await salesAPI.updateStage(opp.id, { stage: newStage });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const formatValue = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  const getStageTotal = (stage: string) =>
    (opportunities[stage] || []).reduce((s, o) => s + Number(o.value), 0);

  if (loading) return <MainLayout><div className="p-8"><Loading /></div></MainLayout>;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
            <p className="text-gray-500 text-sm mt-1">
              {Object.values(opportunities).flat().length} total opportunities ·{' '}
              {formatValue(Object.values(opportunities).flat().reduce((s, o) => s + Number(o.value), 0))} pipeline value
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              >
                Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
              >
                List
              </button>
            </div>
            <Button onClick={() => setShowModal(true)} icon={<Plus className="w-4 h-4" />}>New Deal</Button>
          </div>
        </div>

        {/* Stage Summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {STAGES.map(({ key, label, dot }) => (
            <Card key={key} className="text-center" padding={false}>
              <div className="p-3">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${dot}`} />
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">{(opportunities[key] || []).length}</p>
                <p className="text-xs text-gray-500">{formatValue(getStageTotal(key))}</p>
              </div>
            </Card>
          ))}
        </div>

        {view === 'kanban' ? (
          /* Kanban Board */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(({ key, label, color }) => (
              <div key={key} className="flex-shrink-0 w-72">
                <div className={`p-3 rounded-t-xl border border-b-0 ${color} flex items-center justify-between`}>
                  <span className="font-semibold text-sm">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-75">{formatValue(getStageTotal(key))}</span>
                    <span className="bg-white/60 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {(opportunities[key] || []).length}
                    </span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-b-xl border border-gray-200 min-h-32 p-2 space-y-2">
                  {(opportunities[key] || []).map((opp) => (
                    <div
                      key={opp.id}
                      className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                    >
                      <p className="font-semibold text-xs text-gray-900 mb-1 leading-tight">{opp.title}</p>
                      <p className="text-xs text-gray-500 mb-2">{opp.customer_name}</p>

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1 text-green-600">
                          <DollarSign className="w-3 h-3" />
                          <span className="text-xs font-bold">{formatValue(Number(opp.value))}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Target className="w-3 h-3" />
                          <span className="text-xs">{opp.probability}%</span>
                        </div>
                      </div>

                      {opp.expected_close_date && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(opp.expected_close_date).toLocaleDateString()}</span>
                        </div>
                      )}

                      {/* Stage move buttons */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 pt-2 border-t border-gray-100">
                        {STAGES.filter(s => s.key !== key).slice(0, 3).map((s) => (
                          <button
                            key={s.key}
                            onClick={() => moveStage(opp, s.key)}
                            className="text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 px-1.5 py-0.5 rounded transition-colors"
                          >
                            → {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(opportunities[key] || []).length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-400">No deals here</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Deal', 'Customer', 'Stage', 'Value', 'Probability', 'Close Date', 'Assigned'].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.values(opportunities).flat().map((opp) => (
                  <tr key={opp.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900">{opp.title}</td>
                    <td className="py-3 px-4 text-gray-600">{opp.customer_name}</td>
                    <td className="py-3 px-4">
                      <Badge variant={stageBadge[opp.stage]}>{opp.stage}</Badge>
                    </td>
                    <td className="py-3 px-4 font-semibold text-green-600">{formatValue(Number(opp.value))}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${opp.probability}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{opp.probability}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{opp.assigned_to_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* New Opportunity Modal */}
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Opportunity" size="lg">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Deal Title *"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Q1 FCL Container Shipment"
              />
            </div>
            <Select
              label="Customer *"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              options={[
                { value: '', label: 'Select Customer' },
                ...customers.map(c => ({ value: c.id, label: c.company_name })),
              ]}
            />
            <Select
              label="Stage"
              value={formData.stage}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
              options={STAGES.map(s => ({ value: s.key, label: s.label }))}
            />
            <Input
              label="Deal Value (USD)"
              type="number"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="25000"
            />
            <Input
              label="Probability (%)"
              type="number"
              value={formData.probability}
              onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
              placeholder="50"
            />
            <Input
              label="Expected Close Date"
              type="date"
              value={formData.expectedCloseDate}
              onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
            />
            <Select
              label="Shipping Mode"
              value={formData.shippingMode}
              onChange={(e) => setFormData({ ...formData, shippingMode: e.target.value })}
              options={[
                { value: '', label: 'Select Mode' },
                { value: 'sea', label: 'Sea Freight' },
                { value: 'air', label: 'Air Freight' },
                { value: 'road', label: 'Road Freight' },
                { value: 'rail', label: 'Rail Freight' },
                { value: 'multimodal', label: 'Multimodal' },
              ]}
            />
            <Input
              label="Origin Country"
              value={formData.originCountry}
              onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
              placeholder="China"
            />
            <Input
              label="Destination Country"
              value={formData.destinationCountry}
              onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
              placeholder="USA"
            />
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Deal notes..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create Deal</Button>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
