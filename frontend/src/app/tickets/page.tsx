'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { ticketsAPI, customersAPI, shipmentsAPI } from '@/lib/api';
import { Ticket, Customer, Shipment } from '@/types';
import { Card, Badge, Button, Input, Select, Modal, Loading, EmptyState } from '@/components/ui';
import {
  HeadphonesIcon, Plus, Search, AlertTriangle, Clock, MessageSquare,
  CheckCircle, ArrowRight, User
} from 'lucide-react';

const PRIORITY_CONFIG: Record<string, { badge: 'default' | 'info' | 'warning' | 'danger'; color: string }> = {
  low: { badge: 'default', color: 'text-gray-500' },
  medium: { badge: 'info', color: 'text-blue-500' },
  high: { badge: 'warning', color: 'text-orange-500' },
  critical: { badge: 'danger', color: 'text-red-600' },
};

const STATUS_CONFIG: Record<string, { badge: 'default' | 'info' | 'warning' | 'success' | 'danger' | 'purple'; icon: React.ReactNode }> = {
  open: { badge: 'danger', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  in_progress: { badge: 'info', icon: <Clock className="w-3.5 h-3.5 animate-spin" /> },
  pending_customer: { badge: 'warning', icon: <User className="w-3.5 h-3.5" /> },
  resolved: { badge: 'success', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  closed: { badge: 'default', icon: <CheckCircle className="w-3.5 h-3.5" /> },
};

export default function TicketsPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '', description: '', customerId: '', shipmentId: '',
    category: 'other', priority: 'medium', slaHours: '24',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tickRes, custRes, shipRes] = await Promise.all([
        ticketsAPI.getAll({ status: statusFilter, priority: priorityFilter }),
        customersAPI.getAll({ limit: 200 }),
        shipmentsAPI.getAll({ limit: 200 }),
      ]);
      setTickets(tickRes.data.data);
      setTotal(tickRes.data.total);
      setCustomers(custRes.data.data);
      setShipments(shipRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    if (!isAuthenticated) { router.replace('/login'); return; }
    fetchData();
  }, [isAuthenticated, router, fetchData]);

  const openTicket = async (id: string) => {
    try {
      const res = await ticketsAPI.getOne(id);
      setSelectedTicket(res.data.data);
    } catch (e) { console.error(e); }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await ticketsAPI.create(formData);
      setShowNewModal(false);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await ticketsAPI.update(id, { status });
      const res = await ticketsAPI.getOne(id);
      setSelectedTicket(res.data.data);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !selectedTicket) return;
    try {
      await ticketsAPI.addComment(selectedTicket.id, { content: comment, isInternal });
      setComment('');
      const res = await ticketsAPI.getOne(selectedTicket.id);
      setSelectedTicket(res.data.data);
    } catch (e) { console.error(e); }
  };

  const filtered = tickets.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
    (t.customer_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    critical: tickets.filter(t => t.priority === 'critical' && !['resolved','closed'].includes(t.status)).length,
    slaBreach: tickets.filter(t => t.sla_breached).length,
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
            <p className="text-gray-500 text-sm mt-1">{total} total tickets</p>
          </div>
          <Button onClick={() => setShowNewModal(true)} icon={<Plus className="w-4 h-4" />}>New Ticket</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Open', value: stats.open, color: 'bg-red-50 border-red-100 text-red-700' },
            { label: 'In Progress', value: stats.inProgress, color: 'bg-blue-50 border-blue-100 text-blue-700' },
            { label: 'Critical', value: stats.critical, color: 'bg-orange-50 border-orange-100 text-orange-700' },
            { label: 'SLA Breached', value: stats.slaBreach, color: 'bg-red-50 border-red-100 text-red-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`p-4 rounded-xl border ${color} text-center`}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm font-medium opacity-80">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search tickets..."
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
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'pending_customer', label: 'Pending Customer' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' },
              ]}
              className="w-40"
            />
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={[
                { value: '', label: 'All Priority' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
              className="w-36"
            />
          </div>
        </Card>

        {/* Tickets */}
        {loading ? <Loading /> : filtered.length === 0 ? (
          <EmptyState
            icon={<HeadphonesIcon className="w-8 h-8" />}
            title="No tickets found"
            description="All support tickets will appear here"
            action={<Button onClick={() => setShowNewModal(true)} icon={<Plus className="w-4 h-4" />}>Create Ticket</Button>}
          />
        ) : (
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Ticket #', 'Title', 'Customer', 'Category', 'Priority', 'Status', 'Hours Open', 'Assigned', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 font-medium text-gray-500 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => openTicket(ticket.id)}
                  >
                    <td className="py-3 px-4 font-mono text-xs text-gray-600">{ticket.ticket_number}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {ticket.sla_breached && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <span className="font-medium text-gray-900">{ticket.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{ticket.customer_name}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-xs bg-gray-100 px-2 py-0.5 rounded-full">{ticket.category}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={PRIORITY_CONFIG[ticket.priority]?.badge || 'default'}>{ticket.priority}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {STATUS_CONFIG[ticket.status]?.icon}
                        <Badge variant={STATUS_CONFIG[ticket.status]?.badge || 'default'}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {ticket.hours_open ? `${Math.round(Number(ticket.hours_open))}h` : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{ticket.assigned_to_name || 'Unassigned'}</td>
                    <td className="py-3 px-4">
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Ticket Detail Modal */}
        {selectedTicket && (
          <Modal
            isOpen={!!selectedTicket}
            onClose={() => setSelectedTicket(null)}
            title={`${selectedTicket.ticket_number}: ${selectedTicket.title}`}
            size="xl"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-semibold text-sm">{selectedTicket.customer_name}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="font-semibold text-sm capitalize">{selectedTicket.category}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Shipment</p>
                  <p className="font-semibold text-sm">{selectedTicket.shipment_reference || 'N/A'}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700">{selectedTicket.description}</p>
              </div>

              {/* Status Actions */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant={PRIORITY_CONFIG[selectedTicket.priority]?.badge || 'default'}>{selectedTicket.priority}</Badge>
                  <Badge variant={STATUS_CONFIG[selectedTicket.status]?.badge || 'default'}>{selectedTicket.status.replace('_', ' ')}</Badge>
                </div>
                <div className="flex gap-2">
                  {selectedTicket.status === 'open' && (
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')}>
                      Start Working
                    </Button>
                  )}
                  {['open', 'in_progress'].includes(selectedTicket.status) && (
                    <Button size="sm" onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}>
                      Resolve
                    </Button>
                  )}
                  {selectedTicket.status === 'resolved' && (
                    <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}>
                      Close
                    </Button>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div>
                <h4 className="font-semibold text-sm text-gray-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Comments
                </h4>
                <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                  {((selectedTicket as unknown as { comments?: unknown[] }).comments || []).map((c: unknown, i: number) => {
                    const comment = c as { id?: string; content: string; is_internal?: boolean; created_at?: string };
                    return (
                      <div key={comment.id || i} className={`p-3 rounded-lg text-sm ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                        {comment.is_internal && <span className="text-xs text-yellow-600 font-medium block mb-1">Internal Note</span>}
                        <p className="text-gray-700">{comment.content}</p>
                        {comment.created_at && <p className="text-xs text-gray-400 mt-1">{new Date(comment.created_at).toLocaleString()}</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment..."
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                      <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
                      Internal
                    </label>
                    <Button size="sm" onClick={handleAddComment}>Send</Button>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* New Ticket Modal */}
        <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Support Ticket" size="lg">
          <div className="space-y-4">
            <Input
              label="Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the issue"
            />
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
                label="Linked Shipment"
                value={formData.shipmentId}
                onChange={(e) => setFormData({ ...formData, shipmentId: e.target.value })}
                options={[
                  { value: '', label: 'No shipment' },
                  ...shipments.map(s => ({ value: s.id, label: s.reference_number })),
                ]}
              />
              <Select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                options={[
                  { value: 'delay', label: 'Delay' },
                  { value: 'damage', label: 'Damage' },
                  { value: 'billing', label: 'Billing' },
                  { value: 'documentation', label: 'Documentation' },
                  { value: 'customs', label: 'Customs' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <Select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description *</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the issue..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create Ticket</Button>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
