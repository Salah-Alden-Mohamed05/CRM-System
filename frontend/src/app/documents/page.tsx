'use client';
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { documentsAPI, dealsAPI, customersAPI } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Search, RefreshCw, FileText, Upload, Download, Eye, Trash2,
  X, CheckCircle2, AlertCircle, Filter, ChevronDown, ChevronUp,
  Building2, Briefcase, Calendar, Tag, File, FileImage, Archive
} from 'lucide-react';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'contract', label: 'Contract' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'bill_of_lading', label: 'Bill of Lading' },
  { value: 'customs', label: 'Customs' },
  { value: 'packing_list', label: 'Packing List' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'rfq', label: 'RFQ' },
  { value: 'other', label: 'Other' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

function getFileIcon(fileType: string) {
  if (fileType === 'pdf') return { icon: FileText, color: 'text-red-500', bg: 'bg-red-50' };
  if (fileType === 'image') return { icon: FileImage, color: 'text-blue-500', bg: 'bg-blue-50' };
  if (fileType === 'spreadsheet') return { icon: FileText, color: 'text-green-500', bg: 'bg-green-50' };
  if (fileType === 'document') return { icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50' };
  return { icon: File, color: 'text-gray-500', bg: 'bg-gray-50' };
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ onClose, onUploaded, deals, customers, prefillDealId }: {
  onClose: () => void; onUploaded: () => void;
  deals: any[]; customers: any[]; prefillDealId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [form, setForm] = useState({
    name: '',
    documentCategory: 'other',
    description: '',
    dealId: prefillDealId || '',
    customerId: '',
    isInternal: false,
  });
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', form.name || file.name);
      fd.append('documentCategory', form.documentCategory);
      if (form.description) fd.append('description', form.description);
      if (form.dealId) fd.append('dealId', form.dealId);
      if (form.customerId) fd.append('customerId', form.customerId);
      if (form.isInternal) fd.append('isInternal', 'true');
      await documentsAPI.upload(fd);
      onUploaded();
    } catch (e) {
      console.error(e);
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Upload Document</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setForm(p => ({ ...p, name: p.name || f.name })); } }}
            onClick={() => document.getElementById('doc-file-input')?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              drag ? 'border-blue-400 bg-blue-50' :
              file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50/20'
            }`}
          >
            <Upload className={`w-8 h-8 mx-auto mb-3 ${file ? 'text-green-500' : 'text-gray-400'}`} />
            {file ? (
              <div>
                <p className="font-semibold text-green-700">{file.name}</p>
                <p className="text-xs text-green-600 mt-1">{(file.size / 1024).toFixed(0)} KB — Click to change</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Drop file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images, ZIP — max 20MB</p>
              </div>
            )}
            <input id="doc-file-input" type="file" className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.csv,.zip,.txt"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); setForm(p => ({ ...p, name: p.name || f.name })); }
              }} />
          </div>

          {file && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Document Name</label>
                <input type="text" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Document name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                  <select value={form.documentCategory}
                    onChange={e => setForm(p => ({ ...p, documentCategory: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    {CATEGORIES.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Link to Customer</label>
                  <select value={form.customerId}
                    onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">— None —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Link to Deal</label>
                <select value={form.dealId}
                  onChange={e => setForm(p => ({ ...p, dealId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">— None —</option>
                  {deals.map(d => <option key={d.id} value={d.id}>{d.deal_number} – {d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description (optional)</label>
                <input type="text" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of this document..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.isInternal}
                  onChange={e => setForm(p => ({ ...p, isInternal: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                <span>Internal document (hidden from Sales)</span>
              </label>
            </>
          )}
        </div>
        <div className="flex gap-3 justify-end p-6 border-t border-gray-100">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleUpload} disabled={uploading || !file}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────
function DocumentsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillDealId = searchParams.get('dealId') || undefined;

  const [docs, setDocs] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showUpload, setShowUpload] = useState(!!prefillDealId);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, dealsRes, custsRes] = await Promise.all([
        documentsAPI.getAll({ category: filterCategory || undefined, limit: 200 }),
        dealsAPI.getAll({ limit: 200 }),
        customersAPI.getAll({ limit: 200 }),
      ]);
      setDocs(docsRes.data?.data || []);
      setDeals(dealsRes.data?.data || []);
      setCustomers(custsRes.data?.data || []);
    } finally { setLoading(false); }
  }, [filterCategory]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      await documentsAPI.delete(id);
      await fetchData();
      setDeletingId(null);
      showToast('Document deleted');
    } catch { showToast('Failed to delete document', 'error'); }
  };

  const filtered = docs.filter(doc => {
    if (!search) return true;
    const s = search.toLowerCase();
    return doc.name?.toLowerCase().includes(s) ||
      doc.document_category?.toLowerCase().includes(s) ||
      doc.description?.toLowerCase().includes(s);
  });

  // Group by category
  const totalByCategory = CATEGORIES.slice(1).map(cat => ({
    ...cat,
    count: docs.filter(d => d.document_category === cat.value).length,
  })).filter(c => c.count > 0);

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Contracts, quotations, invoices, B/L, customs docs — all in one place
            </p>
          </div>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm">
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        </div>

        {/* Category Quick Stats */}
        {totalByCategory.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterCategory('')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-all ${!filterCategory ? 'bg-blue-600 text-white shadow-sm border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
              All ({docs.length})
            </button>
            {totalByCategory.map(cat => (
              <button key={cat.value} onClick={() => setFilterCategory(filterCategory === cat.value ? '' : cat.value)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-all ${filterCategory === cat.value ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents by name, category..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-400" />
        </div>

        {/* Document List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No documents found</p>
            <button onClick={() => setShowUpload(true)}
              className="mt-3 text-sm text-blue-600 hover:underline">Upload your first document →</button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Document</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Linked To</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Uploaded</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Size</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const fileIcon = getFileIcon(doc.file_type);
                  const isInternal = doc.is_internal;
                  return (
                    <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${fileIcon.bg}`}>
                            <fileIcon.icon className={`w-4.5 h-4.5 ${fileIcon.color}`} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{doc.name}</p>
                            {doc.description && (
                              <p className="text-xs text-gray-400 truncate max-w-xs">{doc.description}</p>
                            )}
                            {isInternal && (
                              <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded mt-0.5 inline-block">Internal</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium capitalize">
                          {(doc.document_category || 'other').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        <div className="space-y-0.5">
                          {doc.deal_number && (
                            <button onClick={() => router.push(`/deals/${doc.deal_id}`)}
                              className="flex items-center gap-1 text-blue-600 hover:underline">
                              <Briefcase className="w-3 h-3" />{doc.deal_number}
                            </button>
                          )}
                          {doc.customer_name && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <Building2 className="w-3 h-3" />{doc.customer_name}
                            </span>
                          )}
                          {!doc.deal_number && !doc.customer_name && '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <div className="text-gray-700">{new Date(doc.created_at).toLocaleDateString()}</div>
                          {doc.uploaded_by_name && (
                            <div className="text-gray-400">{doc.uploaded_by_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {doc.file_type === 'pdf' && doc.file_url && (
                            <a href={`${API_BASE}${doc.file_url}`} target="_blank" rel="noreferrer"
                              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Preview PDF">
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <a href={`${API_BASE}/api/documents/${doc.id}/download`}
                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors" title="Download">
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button onClick={() => setDeletingId(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Upload Modal */}
        {showUpload && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            onUploaded={() => { setShowUpload(false); fetchData(); showToast('Document uploaded!'); }}
            deals={deals}
            customers={customers}
            prefillDealId={prefillDealId}
          />
        )}

        {/* Delete Confirm */}
        {deletingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Document?</h3>
              <p className="text-sm text-gray-500 mb-5">The file will be permanently removed.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setDeletingId(null)}
                  className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deletingId)}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className={`fixed bottom-4 right-4 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>}>
      <DocumentsContent />
    </Suspense>
  );
}
