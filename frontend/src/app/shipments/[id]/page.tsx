'use client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { shipmentsAPI, ticketsAPI, financeAPI, aiAPI } from '@/lib/api';
import { Loading, Badge, Card } from '@/components/ui';
import {
  ArrowLeft, Package, MapPin, Truck, Clock, AlertTriangle,
  CheckCircle, Circle, ChevronRight, DollarSign, MessageSquare,
  Calendar, Anchor, Plane, Plus, Edit2, Brain, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  booking: 'bg-purple-100 text-purple-800',
  pickup: 'bg-indigo-100 text-indigo-800',
  customs_export: 'bg-yellow-100 text-yellow-800',
  departed: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-cyan-100 text-cyan-800',
  customs_import: 'bg-orange-100 text-orange-800',
  arrived: 'bg-lime-100 text-lime-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const milestoneOrder = [
  'booking', 'pickup', 'customs_export', 'departed',
  'in_transit', 'customs_import', 'arrived', 'delivered'
];

const milestoneLabels: Record<string, string> = {
  booking: 'Booking Confirmed',
  pickup: 'Picked Up',
  customs_export: 'Customs (Export)',
  departed: 'Departed',
  in_transit: 'In Transit',
  customs_import: 'Customs (Import)',
  arrived: 'Arrived',
  delivered: 'Delivered',
};

type Tab = 'tracking' | 'details' | 'tickets' | 'finance' | 'ai';

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [shipment, setShipment] = useState<AnyRecord | null>(null);
  const [tickets, setTickets] = useState<AnyRecord[]>([]);
  const [invoices, setInvoices] = useState<AnyRecord[]>([]);
  const [aiPrediction, setAiPrediction] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('tracking');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isDelayed, setIsDelayed] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shipRes, tickRes, invRes, aiRes] = await Promise.allSettled([
        shipmentsAPI.getOne(id),
        ticketsAPI.getAll({ shipment_id: id }),
        financeAPI.getInvoices({ shipment_id: id }),
        aiAPI.predictDelay(id),
      ]);
      if (shipRes.status === 'fulfilled') {
        const s = shipRes.value.data.data;
        setShipment(s);
        setNewStatus(s.status);
        setIsDelayed(s.is_delayed);
      }
      if (tickRes.status === 'fulfilled') setTickets(tickRes.value.data.data || []);
      if (invRes.status === 'fulfilled') setInvoices(invRes.value.data.data || []);
      if (aiRes.status === 'fulfilled') setAiPrediction(aiRes.value.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    try {
      await shipmentsAPI.updateStatus(id, {
        status: newStatus,
        is_delayed: isDelayed,
        notes: statusNote,
      });
      setShowStatusModal(false);
      setStatusNote('');
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

  if (!shipment) return (
    <MainLayout>
      <div className="text-center py-16 text-gray-500">Shipment not found</div>
    </MainLayout>
  );

  const milestones = (shipment.milestones as AnyRecord[]) || [];
  const currentMilestoneIdx = milestoneOrder.indexOf(String(shipment.status || ''));
  const shippingModeIcon = String(shipment.shipping_mode || '').includes('air') ? Plane : Anchor;
  const ShipIcon = shippingModeIcon;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'tracking', label: 'Tracking' },
    { id: 'details', label: 'Details' },
    { id: 'tickets', label: 'Support Tickets', count: tickets.length },
    { id: 'finance', label: 'Finance', count: invoices.length },
    { id: 'ai', label: 'AI Insights' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => router.push('/shipments')} className="p-2 hover:bg-gray-100 rounded-lg mt-1">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{String(shipment.reference_number || '')}</h1>
                <Badge className={statusColors[String(shipment.status || '')] || 'bg-gray-100 text-gray-700'}>
                  {String(shipment.status || '').replace(/_/g, ' ')}
                </Badge>
                {shipment.is_delayed && (
                  <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Delayed
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {String(shipment.origin_country || '')} → {String(shipment.destination_country || '')}
                </span>
                <span className="flex items-center gap-1">
                  <ShipIcon className="w-4 h-4" />
                  {String(shipment.shipping_mode || '')}
                </span>
                <span className="flex items-center gap-1 cursor-pointer hover:text-blue-600" onClick={() => router.push(`/customers/${shipment.customer_id}`)}>
                  <Package className="w-4 h-4" />
                  {String(shipment.customer_name || '')}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowStatusModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Edit2 className="w-4 h-4" />
            Update Status
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-gray-500 mb-1">ETD</p>
            <p className="text-sm font-bold text-gray-900">
              {shipment.etd ? format(new Date(String(shipment.etd)), 'dd MMM yyyy') : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Departure</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500 mb-1">ETA</p>
            <p className="text-sm font-bold text-gray-900">
              {shipment.eta ? format(new Date(String(shipment.eta)), 'dd MMM yyyy') : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Arrival</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500 mb-1">Carrier</p>
            <p className="text-sm font-bold text-gray-900">{String(shipment.carrier || '—')}</p>
            <p className="text-xs text-gray-400 mt-1">Shipping line</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500 mb-1">Open Tickets</p>
            <p className="text-sm font-bold text-gray-900">{tickets.filter(t => (t as AnyRecord).status !== 'closed').length}</p>
            <p className="text-xs text-gray-400 mt-1">Support issues</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab: Tracking */}
        {activeTab === 'tracking' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline */}
            <Card className="p-6 lg:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-6">Shipment Milestones</h3>
              <div className="relative">
                {milestoneOrder.map((milestone, idx) => {
                  const completed = idx <= currentMilestoneIdx;
                  const current = idx === currentMilestoneIdx;
                  const milestoneData = milestones.find(m => m.milestone_name === milestone);
                  return (
                    <div key={milestone} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                          completed
                            ? current
                              ? 'bg-blue-600 ring-4 ring-blue-100'
                              : 'bg-green-500'
                            : 'bg-gray-200'
                        }`}>
                          {completed && !current ? (
                            <CheckCircle className="w-4 h-4 text-white" />
                          ) : current ? (
                            <Truck className="w-4 h-4 text-white" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        {idx < milestoneOrder.length - 1 && (
                          <div className={`w-0.5 flex-1 mt-1 ${completed ? 'bg-green-400' : 'bg-gray-200'}`} style={{minHeight: '24px'}} />
                        )}
                      </div>
                      <div className="pb-2 flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${completed ? 'text-gray-900' : 'text-gray-400'}`}>
                            {milestoneLabels[milestone]}
                          </p>
                          {milestoneData?.completed_at && (
                            <p className="text-xs text-gray-500">
                              {format(new Date(String(milestoneData.completed_at)), 'dd MMM yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                        {milestoneData?.notes && (
                          <p className="text-xs text-gray-500 mt-0.5">{String(milestoneData.notes)}</p>
                        )}
                        {!milestoneData && milestoneData === undefined && idx > currentMilestoneIdx && (
                          <p className="text-xs text-gray-400 mt-0.5">Pending</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Route Info */}
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Route Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Origin</p>
                    <p className="text-sm font-medium text-gray-900">{String(shipment.origin_country || '')}</p>
                    {shipment.origin_port && <p className="text-xs text-gray-500">Port: {String(shipment.origin_port)}</p>}
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-blue-200" />
                    <ShipIcon className="w-4 h-4 text-blue-500" />
                    <div className="flex-1 h-px bg-blue-200" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Destination</p>
                    <p className="text-sm font-medium text-gray-900">{String(shipment.destination_country || '')}</p>
                    {shipment.destination_port && <p className="text-xs text-gray-500">Port: {String(shipment.destination_port)}</p>}
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Cargo Details</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Weight', value: shipment.weight_kg ? `${shipment.weight_kg} kg` : null },
                    { label: 'Volume', value: shipment.volume_cbm ? `${shipment.volume_cbm} CBM` : null },
                    { label: 'Containers', value: shipment.container_count },
                    { label: 'Container Type', value: shipment.container_type },
                    { label: 'Incoterm', value: shipment.incoterm },
                    { label: 'HS Code', value: shipment.hs_code },
                  ].filter(item => item.value).map(item => (
                    <div key={item.label} className="flex justify-between">
                      <span className="text-gray-500">{item.label}</span>
                      <span className="font-medium text-gray-900">{String(item.value)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tab: Details */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Shipment Information</h3>
              <div className="space-y-3">
                {[
                  { label: 'Reference Number', value: shipment.reference_number },
                  { label: 'Customer', value: shipment.customer_name },
                  { label: 'Shipping Mode', value: shipment.shipping_mode },
                  { label: 'Carrier', value: shipment.carrier },
                  { label: 'Tracking Number', value: shipment.tracking_number },
                  { label: 'Incoterm', value: shipment.incoterm },
                  { label: 'Assigned To', value: shipment.assigned_to_name },
                ].filter(item => item.value).map(item => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500">{item.label}</span>
                    <span className="text-sm font-medium text-gray-900">{String(item.value)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Dates</h3>
              <div className="space-y-3">
                {[
                  { label: 'Created', value: shipment.created_at ? format(new Date(String(shipment.created_at)), 'dd MMM yyyy') : null },
                  { label: 'Departure (ETD)', value: shipment.etd ? format(new Date(String(shipment.etd)), 'dd MMM yyyy') : null },
                  { label: 'Arrival (ETA)', value: shipment.eta ? format(new Date(String(shipment.eta)), 'dd MMM yyyy') : null },
                  { label: 'Actual Departure', value: shipment.actual_departure ? format(new Date(String(shipment.actual_departure)), 'dd MMM yyyy') : null },
                  { label: 'Actual Arrival', value: shipment.actual_arrival ? format(new Date(String(shipment.actual_arrival)), 'dd MMM yyyy') : null },
                ].filter(item => item.value).map(item => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {item.label}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{String(item.value)}</span>
                  </div>
                ))}
              </div>
            </Card>

            {shipment.notes && (
              <Card className="p-6 lg:col-span-2">
                <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-700">{String(shipment.notes)}</p>
              </Card>
            )}
          </div>
        )}

        {/* Tab: Support Tickets */}
        {activeTab === 'tickets' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Support Tickets ({tickets.length})</h3>
              <button
                onClick={() => router.push('/tickets')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New Ticket
              </button>
            </div>
            <div className="space-y-3">
              {tickets.map((t) => {
                const ticket = t as AnyRecord;
                const priorityColors: Record<string, string> = {
                  low: 'bg-gray-100 text-gray-700',
                  medium: 'bg-yellow-100 text-yellow-700',
                  high: 'bg-orange-100 text-orange-700',
                  critical: 'bg-red-100 text-red-700',
                };
                const statusCols: Record<string, string> = {
                  open: 'bg-blue-100 text-blue-700',
                  in_progress: 'bg-yellow-100 text-yellow-700',
                  resolved: 'bg-green-100 text-green-700',
                  closed: 'bg-gray-100 text-gray-700',
                };
                return (
                  <Card
                    key={String(ticket.id)}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/tickets/${ticket.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{String(ticket.ticket_number || '')}</p>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{String(ticket.subject || '')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={priorityColors[String(ticket.priority || '')] || ''}>
                          {String(ticket.priority || '')}
                        </Badge>
                        <Badge className={statusCols[String(ticket.status || '')] || ''}>
                          {String(ticket.status || '')}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                );
              })}
              {tickets.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No support tickets for this shipment</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Finance */}
        {activeTab === 'finance' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Finance ({invoices.length} invoices)</h3>
            <div className="space-y-3">
              {invoices.map((inv) => {
                const invoice = inv as AnyRecord;
                const statusColorMap: Record<string, string> = {
                  paid: 'bg-green-100 text-green-800',
                  sent: 'bg-blue-100 text-blue-800',
                  overdue: 'bg-red-100 text-red-800',
                  draft: 'bg-gray-100 text-gray-700',
                };
                return (
                  <Card key={String(invoice.id)} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{String(invoice.invoice_number || '')}</p>
                          <p className="text-xs text-gray-500">
                            Total: ${Number(invoice.total_amount || 0).toLocaleString()}
                            {invoice.paid_amount ? ` · Paid: $${Number(invoice.paid_amount).toLocaleString()}` : ''}
                          </p>
                        </div>
                      </div>
                      <Badge className={statusColorMap[String(invoice.status || '')] || 'bg-gray-100 text-gray-700'}>
                        {String(invoice.status || '')}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
              {invoices.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No invoices for this shipment</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: AI Insights */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {aiPrediction ? (
              <>
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">Delay Prediction</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Delay Probability</span>
                      <span className={`text-lg font-bold ${
                        Number(aiPrediction.delay_probability) > 0.6 ? 'text-red-600' :
                        Number(aiPrediction.delay_probability) > 0.3 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {Math.round(Number(aiPrediction.delay_probability) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          Number(aiPrediction.delay_probability) > 0.6 ? 'bg-red-500' :
                          Number(aiPrediction.delay_probability) > 0.3 ? 'bg-orange-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Number(aiPrediction.delay_probability) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{String(aiPrediction.reasoning || '')}</p>
                  </div>
                  {(aiPrediction.risk_factors as string[])?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-gray-700 mb-2">Risk Factors</p>
                      <ul className="space-y-1">
                        {(aiPrediction.risk_factors as string[]).map((factor, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Recommendations</h3>
                  </div>
                  <div className="space-y-2">
                    {(aiPrediction.recommendations as string[])?.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-800">{rec}</p>
                      </div>
                    ))}
                  </div>
                  {aiPrediction.estimated_delay_days && (
                    <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                      <p className="text-xs font-medium text-orange-800">
                        Estimated delay: {String(aiPrediction.estimated_delay_days)} days
                      </p>
                    </div>
                  )}
                </Card>
              </>
            ) : (
              <div className="col-span-2 text-center py-8 text-gray-500">
                <Brain className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">AI prediction unavailable</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Update Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Update Shipment Status</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {milestoneOrder.map(s => (
                    <option key={s} value={s}>{milestoneLabels[s]}</option>
                  ))}
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="delayed"
                  checked={isDelayed}
                  onChange={e => setIsDelayed(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="delayed" className="text-sm text-gray-700">Mark as Delayed</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={statusNote}
                  onChange={e => setStatusNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Add a note about this status update..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={handleUpdateStatus} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
