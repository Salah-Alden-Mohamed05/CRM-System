'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { financeAPI, customersAPI, shipmentsAPI } from '@/lib/api';
import { Invoice, Customer, Shipment } from '@/types';
import { Card, Badge, Button, Input, Select, Modal, Loading, EmptyState } from '@/components/ui';
import { DollarSign, Plus, Search, TrendingUp, AlertCircle, CheckCircle, Clock, ArrowRight } from 'lucide-react';

const STATUS_CONFIG: Record<string, { badge: 'default' | 'info' | 'warning' | 'success' | 'danger' | 'purple'; label: string }> = {
  draft: { badge: 'default', label: 'Draft' },
  sent: { badge: 'info', label: 'Sent' },
  partial: { badge: 'warning', label: 'Partial' },
  paid: { badge: 'success', label: 'Paid' },
  overdue: { badge: 'danger', label: 'Overdue' },
  cancelled: { badge: 'default', label: 'Cancelled' },
};

interface InvoiceItem { description: string; quantity: number; unitPrice: string; amount: number }

export default function FinancePage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unitPrice: '', amount: 0 }
  ]);
  const [invoiceForm, setInvoiceForm] = useState({
    customerId: '', shipmentId: '', issueDate: new Date().toISOString().split('T')[0],
    dueDate: '', taxRate: '10', discountAmount: '0', notes: '', currency: 'USD',
  });
  const [paymentForm, setPaymentForm] = useState({
    invoiceId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer', referenceNumber: '', notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, custRes, shipRes] = await Promise.all([
        financeAPI.getInvoices({ status: statusFilter }),
        customersAPI.getAll({ limit: 200 }),
        shipmentsAPI.getAll({ limit: 200 }),
      ]);
      setInvoices(invRes.data.data);
      setTotal(invRes.data.total);
      setCustomers(custRes.data.data);
      setShipments(shipRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    fetchData();
  }, [isAuthenticated, router, fetchData]);

  const handleCreateInvoice = async () => {
    setSaving(true);
    try {
      const items = invoiceItems.filter(i => i.description && i.unitPrice);
      await financeAPI.createInvoice({ ...invoiceForm, items });
      setShowInvoiceModal(false);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleRecordPayment = async () => {
    setSaving(true);
    try {
      await financeAPI.recordPayment(paymentForm);
      setShowPaymentModal(false);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const openPayment = (inv: Invoice) => {
    setPaymentForm({ ...paymentForm, invoiceId: inv.id, amount: String(inv.outstanding_amount) });
    setShowPaymentModal(true);
  };

  const updateItem = (i: number, field: keyof InvoiceItem, val: string) => {
    const items = [...invoiceItems];
    items[i] = { ...items[i], [field]: val };
    if (field === 'quantity' || field === 'unitPrice') {
      items[i].amount = Number(items[i].quantity) * Number(items[i].unitPrice || 0);
    }
    setInvoiceItems(items);
  };

  const stats = {
    totalInvoiced: invoices.reduce((s, i) => s + Number(i.total_amount), 0),
    totalPaid: invoices.reduce((s, i) => s + Number(i.paid_amount), 0),
    outstanding: invoices.reduce((s, i) => s + Number(i.outstanding_amount), 0),
    overdue: invoices.filter(i => i.status === 'overdue').length,
  };

  const filtered = invoices.filter(inv =>
    !search || inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customer_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
            <p className="text-gray-500 text-sm mt-1">Invoices & Payments Management</p>
          </div>
          <Button onClick={() => setShowInvoiceModal(true)} icon={<Plus className="w-4 h-4" />}>New Invoice</Button>
        </div>

        {/* Finance Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg text-white"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Invoiced</p>
                <p className="font-bold text-blue-900">{fmt(stats.totalInvoiced)}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg text-white"><CheckCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-green-600 font-medium">Collected</p>
                <p className="font-bold text-green-900">{fmt(stats.totalPaid)}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg text-white"><Clock className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-yellow-600 font-medium">Outstanding</p>
                <p className="font-bold text-yellow-900">{fmt(stats.outstanding)}</p>
              </div>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500 rounded-lg text-white"><AlertCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-red-600 font-medium">Overdue</p>
                <p className="font-bold text-red-900">{stats.overdue} invoices</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
              ]}
              className="w-40"
            />
          </div>
        </Card>

        {/* Invoices Table */}
        {loading ? <Loading /> : filtered.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="w-8 h-8" />}
            title="No invoices found"
            description="Create your first invoice"
            action={<Button onClick={() => setShowInvoiceModal(true)} icon={<Plus className="w-4 h-4" />}>Create Invoice</Button>}
          />
        ) : (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Invoice #', 'Customer', 'Shipment', 'Issue Date', 'Due Date', 'Total', 'Paid', 'Outstanding', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-medium text-gray-500 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-gray-700">{inv.invoice_number}</td>
                    <td className="py-3 px-4 text-gray-700 font-medium">{inv.customer_name}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{inv.shipment_reference || '-'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{new Date(inv.issue_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{new Date(inv.due_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">{fmt(Number(inv.total_amount))}</td>
                    <td className="py-3 px-4 text-green-600 font-medium">{fmt(Number(inv.paid_amount))}</td>
                    <td className="py-3 px-4 font-semibold text-orange-600">
                      {Number(inv.outstanding_amount) > 0 ? fmt(Number(inv.outstanding_amount)) : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={STATUS_CONFIG[inv.status]?.badge || 'default'}>{STATUS_CONFIG[inv.status]?.label || inv.status}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {['sent', 'partial', 'overdue'].includes(inv.status) && (
                          <Button size="sm" variant="outline" onClick={() => openPayment(inv)}>
                            Record Payment
                          </Button>
                        )}
                        <ArrowRight className="w-4 h-4 text-gray-400 cursor-pointer" onClick={() => setSelectedInvoice(inv)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* New Invoice Modal */}
        <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Create Invoice" size="xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Customer *"
                value={invoiceForm.customerId}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, customerId: e.target.value })}
                options={[
                  { value: '', label: 'Select Customer' },
                  ...customers.map(c => ({ value: c.id, label: c.company_name })),
                ]}
              />
              <Select
                label="Linked Shipment"
                value={invoiceForm.shipmentId}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, shipmentId: e.target.value })}
                options={[
                  { value: '', label: 'No shipment' },
                  ...shipments.map(s => ({ value: s.id, label: s.reference_number })),
                ]}
              />
              <Input
                label="Issue Date"
                type="date"
                value={invoiceForm.issueDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
              />
              <Input
                label="Due Date *"
                type="date"
                value={invoiceForm.dueDate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
              />
              <Input
                label="Tax Rate (%)"
                type="number"
                value={invoiceForm.taxRate}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, taxRate: e.target.value })}
              />
              <Select
                label="Currency"
                value={invoiceForm.currency}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, currency: e.target.value })}
                options={['USD', 'EUR', 'GBP', 'AED', 'CNY'].map(c => ({ value: c, label: c }))}
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Line Items</label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setInvoiceItems([...invoiceItems, { description: '', quantity: 1, unitPrice: '', amount: 0 }])}
                >
                  + Add Line
                </Button>
              </div>
              <div className="space-y-2">
                {invoiceItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(i, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Unit Price"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(i, 'unitPrice', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-semibold text-gray-700">
                        ${(Number(item.quantity) * Number(item.unitPrice || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm flex justify-end gap-6">
                <span className="text-gray-500">Subtotal: <strong>${invoiceItems.reduce((s, i) => s + i.amount, 0).toLocaleString()}</strong></span>
                <span className="text-gray-500">Tax ({invoiceForm.taxRate}%): <strong>${(invoiceItems.reduce((s, i) => s + i.amount, 0) * Number(invoiceForm.taxRate) / 100).toLocaleString()}</strong></span>
                <span className="font-bold">Total: ${(invoiceItems.reduce((s, i) => s + i.amount, 0) * (1 + Number(invoiceForm.taxRate) / 100)).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowInvoiceModal(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} loading={saving}>Create Invoice</Button>
          </div>
        </Modal>

        {/* Payment Modal */}
        <Modal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment" size="md">
          <div className="space-y-4">
            <Input
              label="Amount"
              type="number"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
            <Input
              label="Payment Date"
              type="date"
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
            />
            <Select
              label="Payment Method"
              value={paymentForm.paymentMethod}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'check', label: 'Check' },
                { value: 'cash', label: 'Cash' },
                { value: 'letter_of_credit', label: 'Letter of Credit' },
              ]}
            />
            <Input
              label="Reference Number"
              value={paymentForm.referenceNumber}
              onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
              placeholder="Bank transaction ref..."
            />
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} loading={saving}>Record Payment</Button>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
