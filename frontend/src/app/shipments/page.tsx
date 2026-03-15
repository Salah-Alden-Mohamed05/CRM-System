'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { shipmentsAPI, customersAPI } from '@/lib/api';
import { Shipment, Milestone, Customer } from '@/types';
import { Card, Badge, Button, Input, Select, Modal, Loading, EmptyState } from '@/components/ui';
import { useTranslation } from '@/lib/i18n';
import {
  Package, Plus, AlertTriangle, CheckCircle2, Clock, Plane,
  Ship, Truck, Train, ArrowRight, MapPin, Calendar, Search, RefreshCw
} from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'purple'> = {
  booking: 'default', pickup: 'info', customs_export: 'warning', departed: 'purple',
  in_transit: 'info', customs_import: 'warning', arrived: 'success', delivered: 'success', cancelled: 'danger',
};
const STATUS_COLOR: Record<string, string> = {
  booking: 'bg-gray-500', pickup: 'bg-blue-500', customs_export: 'bg-yellow-500', departed: 'bg-purple-500',
  in_transit: 'bg-cyan-500', customs_import: 'bg-orange-500', arrived: 'bg-lime-500', delivered: 'bg-green-500', cancelled: 'bg-red-500',
};

const ModeIcon = ({ mode }: { mode?: string }) => {
  const cls = 'w-4 h-4';
  switch (mode) {
    case 'air': return <Plane className={cls} />;
    case 'sea': return <Ship className={cls} />;
    case 'road': return <Truck className={cls} />;
    case 'rail': return <Train className={cls} />;
    default: return <Package className={cls} />;
  }
};

export default function ShipmentsPage() {
  const { isAuthenticated } = useAuth();
  const { t, isRTL } = useTranslation();
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '', shippingMode: 'sea', serviceType: '', originCountry: '',
    originPort: '', destinationCountry: '', destinationPort: '', cargoDescription: '',
    cargoWeight: '', cargoVolume: '', carrier: '', eta: '', etd: '', incoterm: 'CIF',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [shipRes, custRes] = await Promise.all([
        shipmentsAPI.getAll({ search, status: statusFilter, isDelayed: delayedOnly ? 'true' : '' }),
        customersAPI.getAll({ limit: 200 }),
      ]);
      setShipments(shipRes.data.data);
      setTotal(shipRes.data.total);
      setCustomers(custRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, statusFilter, delayedOnly]);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [isAuthenticated, router, fetchData]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await shipmentsAPI.create(formData);
      setShowNewModal(false);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const updateMilestone = async (shipmentId: string, milestoneId: string, status: string) => {
    try {
      await shipmentsAPI.updateMilestone(shipmentId, milestoneId, { status });
      if (selectedShipment) {
        const res = await shipmentsAPI.getOne(selectedShipment.id);
        setSelectedShipment(res.data.data);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('shipments.title')}</h1>
            <p className="text-gray-500 text-sm mt-1">{total} {t('common.total')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title={t('common.refresh')}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button onClick={() => setShowNewModal(true)} icon={<Plus className="w-4 h-4" />}>{t('shipments.newShipment')}</Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <Input
                placeholder={isRTL ? 'بحث بالمرجع أو العميل…' : 'Search by reference or customer...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: isRTL ? 'جميع الحالات' : 'All Statuses' },
                ...Object.keys(STATUS_BADGE).map(k => ({ value: k, label: k.replace(/_/g, ' ') })),
              ]}
              className="w-40"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={delayedOnly}
                onChange={(e) => setDelayedOnly(e.target.checked)}
                className="rounded text-orange-500"
              />
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              {isRTL ? 'المتأخرة فقط' : 'Delayed only'}
            </label>
          </div>
        </Card>

        {/* Shipments List */}
        {loading ? <Loading /> : shipments.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8" />}
            title={t('common.noData')}
            description={isRTL ? 'أنشئ شحنتك الأولى لبدء التتبع' : 'Create your first shipment to start tracking'}
            action={<Button onClick={() => setShowNewModal(true)} icon={<Plus className="w-4 h-4" />}>{t('shipments.newShipment')}</Button>}
          />
        ) : (
          <div className="space-y-3">
            {shipments.map((shipment) => {
              return (
                <Card
                  key={shipment.id}
                  padding={false}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    shipmentsAPI.getOne(shipment.id).then(r => setSelectedShipment(r.data.data));
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
                      {/* Left */}
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 ${STATUS_COLOR[shipment.status] || 'bg-gray-500'} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                          <ModeIcon mode={shipment.shipping_mode} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-sm">{shipment.reference_number}</span>
                            {shipment.is_delayed && (
                              <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                <AlertTriangle className="w-3 h-3" /> {t('shipments.statuses.delayed')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{shipment.customer_name}</p>
                        </div>
                      </div>

                      {/* Route */}
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1 text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-blue-400" />
                          <span className="font-medium">{shipment.origin_country}</span>
                          {shipment.origin_port && <span className="text-gray-400 text-xs">({shipment.origin_port})</span>}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-300" />
                        <div className="flex items-center gap-1 text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-green-400" />
                          <span className="font-medium">{shipment.destination_country}</span>
                          {shipment.destination_port && <span className="text-gray-400 text-xs">({shipment.destination_port})</span>}
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="flex gap-4 text-xs text-gray-500">
                        {shipment.etd && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>ETD: {new Date(shipment.etd).toLocaleDateString()}</span>
                          </div>
                        )}
                        {shipment.eta && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>ETA: {new Date(shipment.eta).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Status + Actions */}
                      <div className="flex items-center gap-3">
                        {shipment.carrier && <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">{shipment.carrier}</span>}
                        <Badge variant={STATUS_BADGE[shipment.status] || 'default'}>{shipment.status.replace(/_/g, ' ')}</Badge>
                        {(shipment.open_ticket_count || 0) > 0 && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                            {shipment.open_ticket_count} ticket{(shipment.open_ticket_count || 0) > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Shipment Detail Modal */}
        {selectedShipment && (
          <Modal
            isOpen={!!selectedShipment}
            onClose={() => setSelectedShipment(null)}
            title={`${t('shipments.title')}: ${selectedShipment.reference_number}`}
            size="xl"
          >
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">{t('shipments.customer')}</p>
                  <p className="font-semibold text-sm">{selectedShipment.customer_name}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">{t('shipments.shippingMode')}</p>
                  <p className="font-semibold text-sm capitalize">{selectedShipment.shipping_mode}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">{t('shipments.carrier')}</p>
                  <p className="font-semibold text-sm">{selectedShipment.carrier || 'TBD'}</p>
                </div>
              </div>

              {/* Milestones */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">{t('shipments.milestones')}</h4>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-3">
                    {(selectedShipment.milestones || []).map((m: Milestone) => (
                      <div key={m.id} className="flex items-start gap-4 relative">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                          m.status === 'completed' ? 'bg-green-500 text-white' :
                          m.status === 'in_progress' ? 'bg-blue-500 text-white' :
                          m.status === 'delayed' ? 'bg-orange-500 text-white' :
                          'bg-gray-200 text-gray-400'
                        }`}>
                          {m.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
                           m.status === 'in_progress' ? <Clock className="w-4 h-4 animate-pulse" /> :
                           m.status === 'delayed' ? <AlertTriangle className="w-4 h-4" /> :
                           <div className="w-2 h-2 rounded-full bg-current" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${m.status === 'completed' ? 'text-gray-900' : 'text-gray-500'}`}>
                              {m.milestone_type}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-gray-400">
                                {m.actual_date
                                  ? new Date(m.actual_date).toLocaleDateString()
                                  : m.planned_date
                                  ? `Est. ${new Date(m.planned_date).toLocaleDateString()}`
                                  : 'TBD'}
                              </p>
                              {m.status === 'pending' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); updateMilestone(selectedShipment.id, m.id, 'completed'); }}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                                >
                                  {isRTL ? 'تم' : 'Mark Done'}
                                </button>
                              )}
                            </div>
                          </div>
                          {m.location && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{m.location}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* New Shipment Modal */}
        <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Shipment" size="xl">
          <div className="grid grid-cols-2 gap-4">
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
              label="Shipping Mode *"
              value={formData.shippingMode}
              onChange={(e) => setFormData({ ...formData, shippingMode: e.target.value })}
              options={[
                { value: 'sea', label: 'Sea Freight' },
                { value: 'air', label: 'Air Freight' },
                { value: 'road', label: 'Road Freight' },
                { value: 'rail', label: 'Rail Freight' },
                { value: 'multimodal', label: 'Multimodal' },
              ]}
            />
            <Input
              label="Origin Country *"
              value={formData.originCountry}
              onChange={(e) => setFormData({ ...formData, originCountry: e.target.value })}
              placeholder="China"
            />
            <Input
              label="Origin Port/City"
              value={formData.originPort}
              onChange={(e) => setFormData({ ...formData, originPort: e.target.value })}
              placeholder="Shanghai"
            />
            <Input
              label="Destination Country *"
              value={formData.destinationCountry}
              onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
              placeholder="USA"
            />
            <Input
              label="Destination Port/City"
              value={formData.destinationPort}
              onChange={(e) => setFormData({ ...formData, destinationPort: e.target.value })}
              placeholder="Los Angeles"
            />
            <Input
              label="Carrier"
              value={formData.carrier}
              onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
              placeholder="COSCO / Maersk"
            />
            <Select
              label="Incoterm"
              value={formData.incoterm}
              onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })}
              options={['EXW','FCA','FOB','CFR','CIF','DDP','DAP'].map(i => ({ value: i, label: i }))}
            />
            <Input
              label="ETD (Estimated Departure)"
              type="date"
              value={formData.etd}
              onChange={(e) => setFormData({ ...formData, etd: e.target.value })}
            />
            <Input
              label="ETA (Estimated Arrival)"
              type="date"
              value={formData.eta}
              onChange={(e) => setFormData({ ...formData, eta: e.target.value })}
            />
            <Input
              label="Cargo Weight (kg)"
              type="number"
              value={formData.cargoWeight}
              onChange={(e) => setFormData({ ...formData, cargoWeight: e.target.value })}
            />
            <Input
              label="Cargo Volume (CBM)"
              type="number"
              value={formData.cargoVolume}
              onChange={(e) => setFormData({ ...formData, cargoVolume: e.target.value })}
            />
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Cargo Description</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                value={formData.cargoDescription}
                onChange={(e) => setFormData({ ...formData, cargoDescription: e.target.value })}
                placeholder="Electronics components, 200 cartons..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create Shipment</Button>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
