'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { customersAPI } from '@/lib/api';
import { Customer } from '@/types';
import { Card, Badge, Button, Input, Select, Modal, Loading, EmptyState } from '@/components/ui';
import { Users, Plus, Search, Building2, Globe, Phone, Mail, Edit, Trash2, Eye } from 'lucide-react';

const statusVariants: Record<string, 'success' | 'info' | 'warning'> = {
  active: 'success', inactive: 'warning', prospect: 'info',
};

export default function CustomersPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [total, setTotal] = useState(0);
  const [formData, setFormData] = useState({
    companyName: '', industry: '', country: '', city: '', website: '',
    taxId: '', status: 'prospect', notes: '', creditLimit: '', paymentTerms: '30',
  });
  const [saving, setSaving] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customersAPI.getAll({ search, status: statusFilter });
      setCustomers(res.data.data);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [isAuthenticated, fetchCustomers, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editCustomer) {
        await customersAPI.update(editCustomer.id, formData);
      } else {
        await customersAPI.create(formData);
      }
      setShowModal(false);
      setEditCustomer(null);
      fetchCustomers();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleEdit = (customer: Customer) => {
    setEditCustomer(customer);
    setFormData({
      companyName: customer.company_name,
      industry: customer.industry || '',
      country: customer.country || '',
      city: customer.city || '',
      website: '',
      taxId: '',
      status: customer.status,
      notes: '',
      creditLimit: '',
      paymentTerms: '30',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer?')) return;
    try { await customersAPI.delete(id); fetchCustomers(); }
    catch (e) { console.error(e); }
  };

  const openNew = () => {
    setEditCustomer(null);
    setFormData({ companyName: '', industry: '', country: '', city: '', website: '', taxId: '', status: 'prospect', notes: '', creditLimit: '', paymentTerms: '30' });
    setShowModal(true);
  };

  const industries = ['', 'Manufacturing', 'Retail', 'Pharmaceuticals', 'Electronics', 'Commodities', 'Automotive', 'Food & Beverage', 'Chemicals', 'Other'];

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-500 text-sm mt-1">{total} total customers</p>
          </div>
          <Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>New Customer</Button>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search customers..."
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
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'prospect', label: 'Prospect' },
              ]}
              className="w-40"
            />
          </div>
        </Card>

        {/* Customer Grid */}
        {loading ? <Loading /> : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No customers found"
            description="Start by adding your first customer to the system"
            action={<Button onClick={openNew} icon={<Plus className="w-4 h-4" />}>Add Customer</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {customers.map((customer) => (
              <Card key={customer.id} padding={false} className="hover:shadow-md transition-shadow">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {customer.company_name[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{customer.company_name}</h3>
                        <p className="text-xs text-gray-500">{customer.industry || 'General'}</p>
                      </div>
                    </div>
                    <Badge variant={statusVariants[customer.status] || 'default'}>{customer.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      <span>{customer.country || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span>{customer.city || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg mb-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Shipments</p>
                      <p className="font-bold text-gray-900 text-sm">{customer.shipment_count || 0}</p>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <p className="text-xs text-gray-500">Deals</p>
                      <p className="font-bold text-gray-900 text-sm">{customer.opportunity_count || 0}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Revenue</p>
                      <p className="font-bold text-gray-900 text-sm">
                        ${Number(customer.total_revenue || 0) > 0
                          ? `${(Number(customer.total_revenue) / 1000).toFixed(0)}k`
                          : '0'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      {customer.assigned_to_name ? `Assigned: ${customer.assigned_to_name}` : 'Unassigned'}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="w-4 h-4" />}
                        onClick={() => router.push(`/customers/${customer.id}`)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Edit className="w-4 h-4" />}
                        onClick={() => handleEdit(customer)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="w-4 h-4 text-red-400" />}
                        onClick={() => handleDelete(customer.id)}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editCustomer ? 'Edit Customer' : 'New Customer'}
          size="lg"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Company Name *"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Global Trade Corp"
              />
            </div>
            <Select
              label="Industry"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              options={industries.map(i => ({ value: i, label: i || 'Select Industry' }))}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'prospect', label: 'Prospect' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <Input
              label="Country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="USA"
            />
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="New York"
            />
            <Input
              label="Website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://company.com"
            />
            <Input
              label="Tax ID"
              value={formData.taxId}
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              placeholder="12-3456789"
            />
            <Input
              label="Credit Limit (USD)"
              type="number"
              value={formData.creditLimit}
              onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
              placeholder="50000"
            />
            <Input
              label="Payment Terms (days)"
              type="number"
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              placeholder="30"
            />
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Customer notes..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editCustomer ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
