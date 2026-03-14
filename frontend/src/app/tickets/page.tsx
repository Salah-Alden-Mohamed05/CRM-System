'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { ticketsAPI, customersAPI, shipmentsAPI } from '@/lib/api';
import { Ticket, Customer, Shipment } from '@/types';
import { Card, Badge, Button, Input, Select, Modal, Loading, EmptyState } from '@/components/ui';
import {
  HeadphonesIcon, Plus, Search, AlertTriangle, Clock,
  MessageSquare, CheckCircle, ArrowRight, User,
  ChevronDown, ChevronUp, Tag
} from 'lucide-react';

const PRIORITY_CONFIG: Record<string, { badge: 'default' | 'info' | 'warning' | 'danger'; color: string; bg: string }> = {
  low:      { badge: 'default', color: 'text-gray-500',  bg: 'bg-gray-100' },
  medium:   { badge: 'info',    color: 'text-blue-600',  bg: 'bg-blue-50' },
  high:     { badge: 'warning', color: 'text-orange-600',bg: 'bg-orange-50' },
  critical: { badge: 'danger',  color: 'text-red-700',   bg: 'bg-red-50' },
};

const STATUS_CONFIG: Record<string, { badge: 'default' | 'info' | 'warning' | 'success' | 'danger' | 'purple'; icon: React.ReactNode; label: string; color: string }> = {
  open:             { badge: 'danger',  icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Open',             color: 'bg-red-100 text-red-700' },
  in_progress:      { badge: 'info',    icon: <Clock className="w-3.5 h-3.5" />,         label: 'In Progress',      color: 'bg-blue-100 text-blue-700' },
  pending_customer: { badge: 'warning', icon: <User className="w-3.5 h-3.5" />,          label: 'Pending Customer', color: 'bg-yellow-100 text-yellow-700' },
  resolved:         { badge: 'success', icon: <CheckCircle className="w-3.5 h-3.5" />,   label: 'Resolved',         color: 'bg-green-100 text-green-700' },
  closed:           { badge: 'default', icon: <CheckCircle className="w-3.5 h-3.5" />,   label: 'Closed',           color: 'bg-gray-100 text-gray-500' },
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
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
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

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Support Tickets</h1>
            <p className="text-gray-500 text-xs md:text-sm mt-0.5">{total} total tickets</p>
          </div>
          <Button onClick={() => setShowNewModal(true)} icon={<Plus className="w-4 h-4" />} className="shrink-0">
            <span className="hidden sm:inline">New Ticket</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* ── Stats — 2×2 on mobile, 4×1 on desktop ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Open',        value: stats.open,       bg: 'bg-red-50 border-red-100',    text: 'text-red-700' },
            { label: 'In Progress', value: stats.inProgress,  bg: 'bg-blue-50 border-blue-100',  text: 'text-blue-700' },
            { label: 'Critical',    value: stats.critical,    bg: 'bg-orange-50 border-orange-100', text: 'text-orange-700' },
            { label: 'SLA Breach',  value: stats.slaBreach,  bg: 'bg-red-50 border-red-100',    text: 'text-red-700' },
          ].map(({ label, value, bg, text }) => (
            <div key={label} className={`p-3 md:p-4 rounded-xl border ${bg} ${text} text-center`}>
              <p className="text-xl md:text-2xl font-bold">{value}</p>
              <p className="text-xs md:text-sm font-medium opacity-80 leading-tight mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Status' },
                  { value: 'open', label: 'Open' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'pending_customer', label: 'Pending' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
                className="flex-1 sm:w-36"
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
                className="flex-1 sm:w-32"
              />
            </div>
          </div>
        </Card>

        {/* ── Tickets ── */}
        {loading ? <Loading /> : filtered.length === 0 ? (
          <EmptyState
            icon={<HeadphonesIcon className="w-8 h-8" />}
            title="No tickets found"
            description="All support tickets will appear here"
            action={
              <Button onClick={() => setShowNewModal(true)} icon={<Plus className="w-4 h-4" />}>
                Create Ticket
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop Table */}
            <Card padding={false} className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Ticket #', 'Title', 'Customer', 'Category', 'Priority', 'Status', 'Hours Open', 'Assigned', ''].map(h => (
                      <th key={h} className="text-left py-3 px-4 font-medium text-gray-500 text-xs whitespace-nowrap">{h}</th>
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
                      <td className="py-3 px-4 font-mono text-xs text-gray-600 whitespace-nowrap">{ticket.ticket_number}</td>
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="flex items-center gap-2">
                          {ticket.sla_breached && <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                          <span className="font-medium text-gray-900 truncate">{ticket.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-[140px] truncate">{ticket.customer_name}</td>
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
                            {STATUS_CONFIG[ticket.status]?.label || ticket.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {ticket.hours_open ? `${Math.round(Number(ticket.hours_open))}h` : '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-[120px] truncate">
                        {ticket.assigned_to_name || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
              {filtered.map((ticket) => {
                const isExpanded = expandedCards.has(ticket.id);
                const statusCfg = STATUS_CONFIG[ticket.status];
                const priorityCfg = PRIORITY_CONFIG[ticket.priority];
                return (
                  <div key={ticket.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Card Header */}
                    <div
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer active:bg-gray-50"
                      onClick={() => toggleCard(ticket.id)}
                    >
                      {/* Priority indicator stripe */}
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                        ticket.priority === 'critical' ? 'bg-red-500' :
                        ticket.priority === 'high' ? 'bg-orange-400' :
                        ticket.priority === 'medium' ? 'bg-blue-400' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-mono text-xs text-gray-500">{ticket.ticket_number}</span>
                          {ticket.sla_breached && (
                            <span className="flex items-center gap-0.5 text-xs text-red-600 font-semibold">
                              <AlertTriangle className="w-3 h-3" /> SLA
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg?.color || 'bg-gray-100 text-gray-500'}`}>
                            {statusCfg?.label || ticket.status}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{ticket.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {ticket.customer_name || 'No customer'} · {ticket.category}
                        </p>
                      </div>
                      <div className="flex-shrink-0 mt-0.5">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500">Priority</p>
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-0.5 px-2 py-0.5 rounded-full ${priorityCfg?.bg} ${priorityCfg?.color}`}>
                              {ticket.priority}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Hours Open</p>
                            <p className="text-sm font-medium text-gray-800 mt-0.5">
                              {ticket.hours_open ? `${Math.round(Number(ticket.hours_open))}h` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Assigned To</p>
                            <p className="text-sm font-medium text-gray-800 mt-0.5">{ticket.assigned_to_name || 'Unassigned'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Category</p>
                            <p className="text-sm font-medium text-gray-800 mt-0.5 capitalize">{ticket.category}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => openTicket(ticket.id)}
                            className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                          >
                            View & Update
                          </button>
                          {ticket.status === 'open' && (
                            <button
                              onClick={() => handleUpdateStatus(ticket.id, 'in_progress')}
                              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors"
                            >
                              Start Working
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Ticket Detail Modal ── */}
        {selectedTicket && (
          <Modal
            isOpen={!!selectedTicket}
            onClose={() => setSelectedTicket(null)}
            title={`${selectedTicket.ticket_number}: ${selectedTicket.title}`}
            size="xl"
          >
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-semibold text-sm mt-0.5">{selectedTicket.customer_name || '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500">Category</p>
                  <p className="font-semibold text-sm mt-0.5 capitalize">{selectedTicket.category}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-500">Shipment</p>
                  <p className="font-semibold text-sm mt-0.5">{selectedTicket.shipment_reference || 'N/A'}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedTicket.description}</p>
              </div>

              {/* Status & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={PRIORITY_CONFIG[selectedTicket.priority]?.badge || 'default'}>
                    {selectedTicket.priority}
                  </Badge>
                  <Badge variant={STATUS_CONFIG[selectedTicket.status]?.badge || 'default'}>
                    {STATUS_CONFIG[selectedTicket.status]?.label || selectedTicket.status.replace('_', ' ')}
                  </Badge>
                  {selectedTicket.sla_breached && (
                    <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> SLA Breached
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
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
                  {((selectedTicket as unknown as { comments?: unknown[] }).comments || []).length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>
                  ) : (
                    ((selectedTicket as unknown as { comments?: unknown[] }).comments || []).map((c: unknown, i: number) => {
                      const cmt = c as { id?: string; content: string; is_internal?: boolean; created_at?: string; author_name?: string };
                      return (
                        <div
                          key={cmt.id || i}
                          className={`p-3 rounded-xl text-sm ${cmt.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100'}`}
                        >
                          {cmt.is_internal && (
                            <span className="text-xs text-yellow-600 font-semibold block mb-1">🔒 Internal Note</span>
                          )}
                          <p className="text-gray-700 leading-relaxed">{cmt.content}</p>
                          <p className="text-xs text-gray-400 mt-1.5">
                            {cmt.author_name && <span className="font-medium">{cmt.author_name} · </span>}
                            {cmt.created_at && new Date(cmt.created_at).toLocaleString()}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Comment */}
                <div className="space-y-2">
                  <textarea
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="w-4 h-4"
                      />
                      Internal note (not visible to customer)
                    </label>
                    <Button size="sm" onClick={handleAddComment} disabled={!comment.trim()}>
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* ── New Ticket Modal ── */}
        <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Support Ticket" size="lg">
          <div className="space-y-4">
            <Input
              label="Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the issue"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the issue..."
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create Ticket</Button>
          </div>
        </Modal>

      </div>
    </MainLayout>
  );
}
