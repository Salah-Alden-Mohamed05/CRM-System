'use client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { customersAPI, shipmentsAPI, salesAPI, financeAPI } from '@/lib/api';
import { Loading, Badge, Card } from '@/components/ui';
import {
  Building2, MapPin, Phone, Mail, Globe, User, Edit2, ArrowLeft,
  Package, TrendingUp, DollarSign, Plus, ChevronRight, FileText,
  Clock, CheckCircle, AlertTriangle, Users
} from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-700',
  prospect: 'bg-blue-100 text-blue-800',
};

const shipmentStatusColors: Record<string, string> = {
  booking: 'bg-purple-100 text-purple-800',
  pickup: 'bg-indigo-100 text-indigo-800',
  in_transit: 'bg-cyan-100 text-cyan-800',
  customs_import: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const stageColors: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-700',
  contacted: 'bg-blue-100 text-blue-700',
  quotation: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

type Tab = 'overview' | 'contacts' | 'shipments' | 'opportunities' | 'invoices';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [customer, setCustomer] = useState<AnyRecord | null>(null);
  const [shipments, setShipments] = useState<AnyRecord[]>([]);
  const [opportunities, setOpportunities] = useState<AnyRecord[]>([]);
  const [invoices, setInvoices] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', position: '', email: '', phone: '' });
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custRes, shipRes, oppRes, invRes] = await Promise.allSettled([
        customersAPI.getOne(id),
        shipmentsAPI.getAll({ customer_id: id }),
        salesAPI.getOpportunities({ customer_id: id }),
        financeAPI.getInvoices({ customer_id: id }),
      ]);
      if (custRes.status === 'fulfilled') {
        const c = custRes.value.data.data;
        setCustomer(c);
        setEditForm({
          company_name: c.company_name || '',
          industry: c.industry || '',
          country: c.country || '',
          city: c.city || '',
          address: c.address || '',
          website: c.website || '',
          phone: c.phone || '',
          email: c.email || '',
          tax_id: c.tax_id || '',
          notes: c.notes || '',
        });
      }
      if (shipRes.status === 'fulfilled') setShipments(shipRes.value.data.data || []);
      if (oppRes.status === 'fulfilled') setOpportunities(oppRes.value.data.data || []);
      if (invRes.status === 'fulfilled') setInvoices(invRes.value.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await customersAPI.update(id, editForm);
      setShowEditModal(false);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddContact = async () => {
    try {
      await customersAPI.createContact(id, contactForm);
      setShowContactModal(false);
      setContactForm({ name: '', position: '', email: '', phone: '' });
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

  if (!customer) return (
    <MainLayout>
      <div className="text-center py-16 text-gray-500">Customer not found</div>
    </MainLayout>
  );

  const totalRevenue = invoices
    .filter((i) => (i as AnyRecord).status === 'paid')
    .reduce((sum, i) => sum + Number((i as AnyRecord).total_amount || 0), 0);

  const outstanding = invoices
    .filter((i) => ['sent', 'overdue'].includes(String((i as AnyRecord).status)))
    .reduce((sum, i) => sum + Number((i as AnyRecord).total_amount || 0), 0);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'contacts', label: 'Contacts', count: ((customer.contacts as AnyRecord[]) || []).length },
    { id: 'shipments', label: 'Shipments', count: shipments.length },
    { id: 'opportunities', label: 'Opportunities', count: opportunities.length },
    { id: 'invoices', label: 'Invoices', count: invoices.length },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push('/customers')}
              className="p-2 hover:bg-gray-100 rounded-lg mt-1"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{String(customer.company_name || '')}</h1>
                <Badge className={statusColors[String(customer.status || '')] || ''}>
                  {String(customer.status || '')}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                {customer.industry && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    {String(customer.industry)}
                  </span>
                )}
                {customer.country && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {customer.city ? `${customer.city}, ` : ''}{String(customer.country)}
                  </span>
                )}
                {customer.created_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Since {format(new Date(String(customer.created_at)), 'MMM yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-gray-900">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1">Paid invoices</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500 mb-1">Outstanding</p>
            <p className="text-xl font-bold text-orange-600">${outstanding.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Unpaid invoices</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500 mb-1">Shipments</p>
            <p className="text-xl font-bold text-gray-900">{shipments.length}</p>
            <p className="text-xs text-blue-600 mt-1">
              {shipments.filter(s => (s as AnyRecord).is_delayed).length} delayed
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500 mb-1">Pipeline Value</p>
            <p className="text-xl font-bold text-gray-900">
              ${opportunities
                .filter(o => !['won', 'lost'].includes(String((o as AnyRecord).stage)))
                .reduce((sum, o) => sum + Number((o as AnyRecord).value || 0), 0)
                .toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Active deals</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
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

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">Company Information</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Industry', value: customer.industry, icon: Building2 },
                  { label: 'Country', value: customer.country, icon: Globe },
                  { label: 'City', value: customer.city, icon: MapPin },
                  { label: 'Website', value: customer.website, icon: Globe },
                  { label: 'Phone', value: customer.phone, icon: Phone },
                  { label: 'Email', value: customer.email, icon: Mail },
                  { label: 'Tax ID', value: customer.tax_id, icon: FileText },
                  { label: 'Assigned To', value: customer.assigned_to_name, icon: User },
                ].map(({ label, value, icon: Icon }) => (
                  value ? (
                    <div key={label} className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-medium text-gray-900">{String(value)}</p>
                      </div>
                    </div>
                  ) : null
                ))}
              </div>
              {customer.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{String(customer.notes)}</p>
                </div>
              )}
            </Card>

            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Recent Shipments</h3>
                <div className="space-y-2">
                  {shipments.slice(0, 4).map((s) => {
                    const sh = s as AnyRecord;
                    return (
                      <div
                        key={String(sh.id)}
                        className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 px-1 rounded"
                        onClick={() => router.push(`/shipments/${sh.id}`)}
                      >
                        <div>
                          <p className="text-xs font-medium text-gray-900">{String(sh.reference_number || '')}</p>
                          <p className="text-xs text-gray-500">{String(sh.origin_country || '')} → {String(sh.destination_country || '')}</p>
                        </div>
                        <Badge className={`text-xs ${shipmentStatusColors[String(sh.status || '')] || 'bg-gray-100 text-gray-700'}`}>
                          {String(sh.status || '').replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    );
                  })}
                  {shipments.length === 0 && <p className="text-xs text-gray-500">No shipments yet</p>}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Active Deals</h3>
                <div className="space-y-2">
                  {opportunities.filter(o => !['won', 'lost'].includes(String((o as AnyRecord).stage))).slice(0, 4).map((o) => {
                    const op = o as AnyRecord;
                    return (
                      <div
                        key={String(op.id)}
                        className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 px-1 rounded"
                        onClick={() => router.push(`/sales/${op.id}`)}
                      >
                        <div>
                          <p className="text-xs font-medium text-gray-900 truncate max-w-[120px]">{String(op.title || '')}</p>
                          <p className="text-xs text-gray-500">${Number(op.value || 0).toLocaleString()}</p>
                        </div>
                        <Badge className={`text-xs ${stageColors[String(op.stage || '')] || ''}`}>
                          {String(op.stage || '')}
                        </Badge>
                      </div>
                    );
                  })}
                  {opportunities.filter(o => !['won', 'lost'].includes(String((o as AnyRecord).stage))).length === 0 && (
                    <p className="text-xs text-gray-500">No active deals</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Contacts ({((customer.contacts as AnyRecord[]) || []).length})</h3>
              <button
                onClick={() => setShowContactModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {((customer.contacts as AnyRecord[]) || []).map((contact) => (
                <Card key={String(contact.id)} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{String(contact.name || '')}</p>
                      {contact.position && <p className="text-xs text-gray-500 mt-0.5">{String(contact.position)}</p>}
                      {contact.email && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <Mail className="w-3 h-3" />{String(contact.email)}
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3" />{String(contact.phone)}
                        </p>
                      )}
                      {contact.is_primary && (
                        <Badge className="mt-1 text-xs bg-blue-100 text-blue-700">Primary</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {((customer.contacts as AnyRecord[]) || []).length === 0 && (
                <div className="col-span-3 text-center py-8 text-gray-500">
                  <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No contacts yet. Add the first contact.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'shipments' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Shipments ({shipments.length})</h3>
              <button
                onClick={() => router.push('/shipments')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New Shipment
              </button>
            </div>
            <div className="space-y-3">
              {shipments.map((s) => {
                const sh = s as AnyRecord;
                return (
                  <Card
                    key={String(sh.id)}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/shipments/${sh.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{String(sh.reference_number || '')}</p>
                          <p className="text-xs text-gray-500">
                            {String(sh.origin_country || '')} → {String(sh.destination_country || '')} · {String(sh.shipping_mode || '')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {sh.is_delayed && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3 h-3" /> Delayed
                          </span>
                        )}
                        <Badge className={`${shipmentStatusColors[String(sh.status || '')] || 'bg-gray-100 text-gray-700'}`}>
                          {String(sh.status || '').replace(/_/g, ' ')}
                        </Badge>
                        {sh.eta && (
                          <p className="text-xs text-gray-500">ETA: {format(new Date(String(sh.eta)), 'dd MMM yyyy')}</p>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                );
              })}
              {shipments.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No shipments for this customer</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Opportunities ({opportunities.length})</h3>
              <button
                onClick={() => router.push('/sales')}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New Opportunity
              </button>
            </div>
            <div className="space-y-3">
              {opportunities.map((o) => {
                const op = o as AnyRecord;
                return (
                  <Card key={String(op.id)} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{String(op.title || '')}</p>
                          <p className="text-xs text-gray-500">
                            ${Number(op.value || 0).toLocaleString()} · {op.probability}% probability
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`${stageColors[String(op.stage || '')] || ''}`}>
                          {String(op.stage || '')}
                        </Badge>
                        {op.expected_close_date && (
                          <p className="text-xs text-gray-500">
                            Close: {format(new Date(String(op.expected_close_date)), 'dd MMM yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
              {opportunities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No opportunities for this customer</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Invoices ({invoices.length})</h3>
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
                        <DollarSign className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{String(invoice.invoice_number || '')}</p>
                          <p className="text-xs text-gray-500">
                            ${Number(invoice.total_amount || 0).toLocaleString()}
                            {invoice.due_date && ` · Due ${format(new Date(String(invoice.due_date)), 'dd MMM yyyy')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`${statusColorMap[String(invoice.status || '')] || 'bg-gray-100 text-gray-700'}`}>
                          {String(invoice.status || '')}
                        </Badge>
                        {String(invoice.status) === 'paid' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
              {invoices.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No invoices for this customer</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Edit Customer</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries({
                  company_name: 'Company Name',
                  industry: 'Industry',
                  country: 'Country',
                  city: 'City',
                  phone: 'Phone',
                  email: 'Email',
                  website: 'Website',
                  tax_id: 'Tax ID',
                }).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      value={editForm[key] || ''}
                      onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editForm.notes || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Contact</h2>
            </div>
            <div className="p-6 space-y-4">
              {Object.entries({
                name: 'Full Name *',
                position: 'Position',
                email: 'Email',
                phone: 'Phone',
              }).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    value={contactForm[key as keyof typeof contactForm] || ''}
                    onChange={e => setContactForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
