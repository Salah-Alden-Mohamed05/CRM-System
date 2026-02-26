'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { ticketsAPI } from '@/lib/api';
import { Loading, Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft, MessageSquare, AlertTriangle, Clock, User,
  ChevronDown, Send, CheckCircle, Package, Tag, Calendar,
  Lock, Unlock
} from 'lucide-react';
import { format } from 'date-fns';

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-800',
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

const categoryLabels: Record<string, string> = {
  delay: 'Shipment Delay',
  damage: 'Cargo Damage',
  billing: 'Billing Issue',
  documentation: 'Documentation',
  customs: 'Customs Issue',
  other: 'Other',
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadTicket();
  }, [id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket]);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const res = await ticketsAPI.getOne(id);
      setTicket(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await ticketsAPI.addComment(id, { content: comment, is_internal: isInternal });
      setComment('');
      await loadTicket();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await ticketsAPI.update(id, { status });
      setShowStatusChange(false);
      await loadTicket();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePriorityChange = async (priority: string) => {
    try {
      await ticketsAPI.update(id, { priority });
      await loadTicket();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <MainLayout>
      <div className="flex items-center justify-center h-64"><Loading /></div>
    </MainLayout>
  );

  if (!ticket) return (
    <MainLayout>
      <div className="text-center py-16 text-gray-500">Ticket not found</div>
    </MainLayout>
  );

  const comments = (ticket.comments as Record<string, unknown>[]) || [];
  const isClosed = ticket.status === 'closed';
  const slaBreached = ticket.sla_breach_at && new Date(String(ticket.sla_breach_at)) < new Date();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => router.push('/tickets')} className="p-2 hover:bg-gray-100 rounded-lg mt-1">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-gray-900">{String(ticket.ticket_number || '')}</h1>
                <Badge className={priorityColors[String(ticket.priority || '')] || ''}>
                  {String(ticket.priority || '').toUpperCase()}
                </Badge>
                <Badge className={statusColors[String(ticket.status || '')] || ''}>
                  {String(ticket.status || '').replace('_', ' ')}
                </Badge>
                {slaBreached && (
                  <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> SLA Breached
                  </Badge>
                )}
              </div>
              <p className="text-base font-medium text-gray-800 mb-1">{String(ticket.subject || '')}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  {categoryLabels[String(ticket.category || '')] || String(ticket.category || '')}
                </span>
                {ticket.customer_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {String(ticket.customer_name)}
                  </span>
                )}
                {ticket.shipment_reference && (
                  <span
                    className="flex items-center gap-1 text-blue-600 cursor-pointer hover:underline"
                    onClick={() => router.push(`/shipments/${ticket.shipment_id}`)}
                  >
                    <Package className="w-4 h-4" />
                    {String(ticket.shipment_reference)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(String(ticket.created_at || '')), 'dd MMM yyyy HH:mm')}
                </span>
              </div>
            </div>
          </div>
          {!isClosed && (
            <div className="flex gap-2 relative">
              <button
                onClick={() => setShowStatusChange(!showStatusChange)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Update Status <ChevronDown className="w-4 h-4" />
              </button>
              {showStatusChange && (
                <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 z-10 w-48">
                  {['in_progress', 'resolved', 'closed'].filter(s => s !== ticket.status).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 capitalize"
                    >
                      Mark as {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content: description + comments */}
          <div className="lg:col-span-2 space-y-4">
            {/* Description */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Description</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{String(ticket.description || 'No description provided.')}</p>
            </Card>

            {/* Comments */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Comments ({comments.length})
              </h3>
              <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
                {comments.map((c) => {
                  const cmt = c as Record<string, unknown>;
                  const isOwn = cmt.created_by === user?.id;
                  return (
                    <div
                      key={String(cmt.id)}
                      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isOwn ? 'bg-blue-500' : 'bg-gray-200'
                      }`}>
                        <span className="text-xs font-medium text-white">
                          {String(cmt.author_name || 'U').charAt(0)}
                        </span>
                      </div>
                      <div className={`flex-1 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className={`rounded-lg p-3 max-w-[80%] ${
                          cmt.is_internal
                            ? 'bg-yellow-50 border border-yellow-200'
                            : isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100'
                        }`}>
                          {cmt.is_internal && (
                            <div className="flex items-center gap-1 mb-1">
                              <Lock className="w-3 h-3 text-yellow-600" />
                              <span className="text-xs text-yellow-600 font-medium">Internal note</span>
                            </div>
                          )}
                          <p className={`text-sm ${isOwn && !cmt.is_internal ? 'text-white' : 'text-gray-800'}`}>
                            {String(cmt.content || '')}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {String(cmt.author_name || '')} · {cmt.created_at ? format(new Date(String(cmt.created_at)), 'dd MMM HH:mm') : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {comments.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No comments yet</p>
                  </div>
                )}
                <div ref={commentsEndRef} />
              </div>

              {!isClosed && (
                <form onSubmit={handleAddComment} className="border-t border-gray-100 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Write a comment..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={e => setIsInternal(e.target.checked)}
                            className="rounded"
                          />
                          {isInternal ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          Internal note
                        </label>
                        <button
                          type="submit"
                          disabled={!comment.trim() || submitting}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                          {submitting ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {isClosed && (
                <div className="border-t border-gray-100 pt-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Ticket is closed
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Ticket Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <Badge className={`mt-1 ${statusColors[String(ticket.status || '')] || ''}`}>
                    {String(ticket.status || '').replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Priority</p>
                  <div className="flex gap-2 flex-wrap">
                    {['low', 'medium', 'high', 'critical'].map(p => (
                      <button
                        key={p}
                        onClick={() => !isClosed && handlePriorityChange(p)}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                          ticket.priority === p
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 text-gray-600 hover:border-blue-300'
                        } ${isClosed ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {ticket.assigned_to_name && (
                  <div>
                    <p className="text-xs text-gray-500">Assigned To</p>
                    <p className="font-medium text-gray-900 mt-1">{String(ticket.assigned_to_name)}</p>
                  </div>
                )}
                {ticket.created_by_name && (
                  <div>
                    <p className="text-xs text-gray-500">Created By</p>
                    <p className="font-medium text-gray-900 mt-1">{String(ticket.created_by_name)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="font-medium text-gray-900 mt-1">
                    {ticket.created_at ? format(new Date(String(ticket.created_at)), 'dd MMM yyyy HH:mm') : '—'}
                  </p>
                </div>
                {ticket.resolved_at && (
                  <div>
                    <p className="text-xs text-gray-500">Resolved</p>
                    <p className="font-medium text-green-700 mt-1">
                      {format(new Date(String(ticket.resolved_at)), 'dd MMM yyyy HH:mm')}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* SLA */}
            <Card className="p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" /> SLA
              </h3>
              {ticket.sla_breach_at ? (
                <div>
                  <p className="text-xs text-gray-500 mb-1">SLA Deadline</p>
                  <p className={`text-sm font-medium ${slaBreached ? 'text-red-600' : 'text-gray-900'}`}>
                    {format(new Date(String(ticket.sla_breach_at)), 'dd MMM yyyy HH:mm')}
                  </p>
                  {slaBreached ? (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="w-3 h-3" /> SLA has been breached
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="w-3 h-3" /> Within SLA
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No SLA set</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
