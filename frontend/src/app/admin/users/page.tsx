'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { authAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';
import { Loading, Badge, Card } from '@/components/ui';
import {
  Users, Plus, Search, Edit2, Trash2, Lock, Unlock,
  Key, CheckCircle, XCircle, Shield, Eye, EyeOff,
  AlertTriangle, RefreshCw, Filter, ChevronDown, X,
  UserCheck, Mail, Phone, Calendar, MoreVertical
} from 'lucide-react';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  is_active: boolean;
  role_name: string;
  role_id: string;
  last_login?: string;
  created_at: string;
  failed_login_attempts: number;
  locked_until?: string;
  password_changed_at?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ── Role colors ─────────────────────────────────────────────
const roleColors: Record<string, string> = {
  Admin:      'bg-red-100 text-red-700',
  Sales:      'bg-blue-100 text-blue-700',
  Operations: 'bg-green-100 text-green-700',
  Finance:    'bg-purple-100 text-purple-700',
  Support:    'bg-orange-100 text-orange-700',
};

// ── Toast Component ─────────────────────────────────────────
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm transition-all ${
            t.type === 'success' ? 'bg-green-600 text-white' :
            t.type === 'error'   ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
          }`}
        >
          {t.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          {t.type === 'error'   && <XCircle    className="w-4 h-4 flex-shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Create/Edit User Modal ───────────────────────────────────
interface UserModalProps {
  user?: User | null;
  roles: Role[];
  onSave: (data: Record<string, string | boolean>) => Promise<void>;
  onClose: () => void;
}

function UserModal({ user, roles, onSave, onClose }: UserModalProps) {
  const { t } = useTranslation();
  // Find a default non-Admin role (e.g. Sales) or fall back to first role
  const defaultRoleId = user?.role_id
    || roles.find(r => r.name === 'Sales')?.id
    || roles.find(r => r.name !== 'Admin')?.id
    || roles[0]?.id
    || '';
  const [form, setForm] = useState({
    first_name:  user?.first_name  || '',
    last_name:   user?.last_name   || '',
    email:       user?.email       || '',
    phone:       user?.phone       || '',
    password:    '',
    role_id:     defaultRoleId,
    is_active:   user?.is_active !== undefined ? user.is_active : true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditing = !!user;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = t('users.firstName') + ' is required';
    if (!form.last_name.trim())  e.last_name  = t('users.lastName')  + ' is required';
    if (!form.email.trim())      e.email      = t('users.email')     + ' is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email format';
    if (!isEditing && !form.password) e.password = 'Password is required';
    if (form.password && form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!form.role_id) e.role_id = t('users.role') + ' is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, string | boolean> = {
        firstName: form.first_name,
        lastName:  form.last_name,
        email:     form.email,
        phone:     form.phone,
        roleId:    form.role_id,
        isActive:  form.is_active,
      };
      if (form.password) payload.password = form.password;
      await onSave(payload);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save user';
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            {isEditing
              ? <><Edit2 className="w-5 h-5 text-blue-600" /> {t('users.editUser')}</>
              : <><Plus  className="w-5 h-5 text-blue-600" /> {t('users.createUser')}</>
            }
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* API Error Banner */}
          {apiError && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'first_name', label: t('users.firstName') + ' *' },
              { key: 'last_name',  label: t('users.lastName')  + ' *' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  value={form[key as keyof typeof form] as string}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
              </div>
            ))}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> {t('users.email')} *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              disabled={isEditing}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'} ${isEditing ? 'bg-gray-50 cursor-not-allowed' : ''}`}
              placeholder="john@company.com"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> {t('users.phone')}
            </label>
            <input
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="+1 555 000 0000"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Key className="w-3.5 h-3.5" /> {isEditing ? t('users.newPassword') : t('users.password') + ' *'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> {t('users.role')} *
            </label>
            <select
              value={form.role_id}
              onChange={e => setForm(p => ({ ...p, role_id: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${errors.role_id ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">Select role…</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name} — {r.description}</option>
              ))}
            </select>
            {errors.role_id && <p className="text-xs text-red-500 mt-1">{errors.role_id}</p>}
          </div>

          {/* Active toggle */}
          {isEditing && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
              </label>
              <span className="text-sm text-gray-700 font-medium">
                {form.is_active ? t('common.active') : t('common.inactive')}
              </span>
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg font-medium">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {saving
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : (isEditing ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />)
            }
            {saving ? t('common.loading') : (isEditing ? t('common.save') : t('users.addUser'))}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ───────────────────────────────
function DeleteModal({ user, onConfirm, onClose }: { user: User; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">{t('users.deactivate')}</h2>
        <p className="text-sm text-gray-500 mb-2">
          {t('users.confirmDeactivate')}
          <span className="font-semibold text-gray-800"> {user.first_name} {user.last_name}</span>
        </p>
        <p className="text-xs text-gray-400 mb-6">This action can be reversed by re-activating the user.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            {t('common.cancel')}
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); setLoading(false); }}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Processing…' : t('users.deactivate')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reset Password Modal ─────────────────────────────────────
function ResetPasswordModal({ user, onSave, onClose }: { user: User; onSave: (pw: string) => Promise<void>; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const { t } = useTranslation();

  const handle = async () => {
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm)  { setError('Passwords do not match'); return; }
    setLoading(true);
    try { await onSave(password); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" /> {t('users.resetPassword')}
          </h2>
          <p className="text-xs text-gray-500 mt-1">For: {user.first_name} {user.last_name}</p>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          {[t('users.password'), 'Confirm Password'].map((label, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={i === 0 ? password : confirm}
                  onChange={e => i === 0 ? setPassword(e.target.value) : setConfirm(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                {i === 0 && (
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">{t('common.cancel')}</button>
          <button onClick={handle} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Resetting…' : t('users.resetPassword')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function AdminUsersPage() {
  const { user: currentUser, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [allUsers, setAllUsers]   = useState<User[]>([]);
  const [users, setUsers]         = useState<User[]>([]);
  const [roles, setRoles]         = useState<Role[]>([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toasts, setToasts]       = useState<Toast[]>([]);

  const [showCreateModal, setShowCreateModal]       = useState(false);
  const [editingUser, setEditingUser]               = useState<User | null>(null);
  const [deletingUser, setDeletingUser]             = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser]   = useState<User | null>(null);
  const [actionMenuUserId, setActionMenuUserId]     = useState<string | null>(null);

  const LIMIT = 10;

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now().toString();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        authAPI.getUsers({ limit: 200 }), // load all then filter client-side
        authAPI.getRoles(),
      ]);
      const fetched: User[] = usersRes.data.data || [];
      setAllUsers(fetched);
      setRoles(rolesRes.data.data || []);
    } catch {
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Client-side filter + paginate
  useEffect(() => {
    let filtered = allUsers;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q)  ||
        u.email?.toLowerCase().includes(q)
      );
    }
    if (roleFilter)               filtered = filtered.filter(u => u.role_name === roleFilter);
    if (statusFilter === 'active')   filtered = filtered.filter(u => u.is_active);
    if (statusFilter === 'inactive') filtered = filtered.filter(u => !u.is_active);
    if (statusFilter === 'locked')   filtered = filtered.filter(u => !!u.locked_until && new Date(u.locked_until) > new Date());

    setTotal(filtered.length);
    setUsers(filtered.slice((page - 1) * LIMIT, page * LIMIT));
  }, [allUsers, search, roleFilter, statusFilter, page]);

  useEffect(() => {
    if (!isAuthenticated)          { router.replace('/login');     return; }
    if (currentUser?.role !== 'Admin') { router.replace('/dashboard'); return; }
    loadData();
  }, [isAuthenticated, currentUser, router, loadData]);

  // ── CRUD handlers ──────────────────────────────────────────
  const handleCreate = async (data: Record<string, string | boolean>) => {
    await authAPI.createUser(data); // throws on error → modal shows inline error
    addToast(t('users.userCreated'), 'success');
    setShowCreateModal(false);
    loadData();
  };

  const handleUpdate = async (data: Record<string, string | boolean>) => {
    if (!editingUser) return;
    await authAPI.updateUser(editingUser.id, data); // throws → modal shows inline error
    addToast(t('users.userUpdated'), 'success');
    setEditingUser(null);
    loadData();
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await authAPI.deleteUser(deletingUser.id);
      addToast(t('users.userDeactivated'), 'success');
      setDeletingUser(null);
      loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to deactivate user';
      addToast(msg, 'error');
    }
  };

  const handleUnlock = async (u: User) => {
    try {
      await authAPI.unlockUser(u.id);
      addToast(t('users.accountUnlocked'), 'success');
      setActionMenuUserId(null);
      loadData();
    } catch {
      addToast('Failed to unlock account', 'error');
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!resetPasswordUser) return;
    try {
      await authAPI.adminResetPassword(resetPasswordUser.id, newPassword);
      addToast(t('users.passwordReset'), 'success');
      setResetPasswordUser(null);
    } catch {
      addToast('Failed to reset password', 'error');
    }
  };

  const isLocked   = (u: User) => !!u.locked_until && new Date(u.locked_until) > new Date();
  const totalPages = Math.ceil(total / LIMIT);
  const activeCount = allUsers.filter(u => u.is_active).length;
  const lockedCount = allUsers.filter(isLocked).length;

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-blue-600" /> {t('users.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('users.subtitle')} — {total} {t('common.total')}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> {t('users.addUser')}
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('users.totalUsers'),  value: loading ? '…' : String(allUsers.length), icon: Users,     color: 'bg-blue-50 text-blue-700' },
            { label: t('users.activeUsers'), value: loading ? '…' : String(activeCount),     icon: UserCheck, color: 'bg-green-50 text-green-700' },
            { label: 'Roles',                value: String(roles.length),                     icon: Shield,    color: 'bg-purple-50 text-purple-700' },
            { label: t('users.lockedUsers'), value: loading ? '…' : String(lockedCount),     icon: Lock,      color: 'bg-red-50 text-red-700' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className={`p-4 flex items-center gap-3 ${color} border-0`}>
              <Icon className="w-8 h-8" />
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs font-medium opacity-80">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name or email…"
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={roleFilter}
                onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="">{t('users.allRoles')}</option>
                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('users.allStatus')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
              <option value="locked">Locked</option>
            </select>

            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" /> {t('common.refresh')}
            </button>
          </div>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden p-0">
          {loading ? (
            <div className="py-20 flex justify-center">
              <Loading />
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('common.noData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['User', t('users.role'), t('users.lastLogin'), t('users.createdAt'), t('common.status'), t('common.actions')].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => {
                    const locked      = isLocked(u);
                    const isCurrentUser = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        {/* User info */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                              roleColors[u.role_name]?.includes('red') ? 'bg-red-500' :
                              roleColors[u.role_name]?.includes('blue') ? 'bg-blue-500' : 'bg-gray-500'
                            }`}>
                              {u.first_name?.[0]}{u.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {u.first_name} {u.last_name}
                                {isCurrentUser && <span className="ml-1 text-xs text-blue-600">(you)</span>}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {u.email}
                              </p>
                              {u.phone && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {u.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${roleColors[u.role_name] || 'bg-gray-100 text-gray-600'}`}>
                            <Shield className="w-3 h-3" />
                            {u.role_name}
                          </span>
                        </td>

                        {/* Last Login */}
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {u.last_login
                            ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(u.last_login), 'MMM d, yyyy HH:mm')}</span>
                            : <span className="text-gray-400 italic">{t('users.never')}</span>
                          }
                        </td>

                        {/* Created At */}
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {format(new Date(u.created_at), 'MMM d, yyyy')}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {locked ? (
                              <Badge variant="danger" className="flex items-center gap-1 w-fit text-xs">
                                <Lock className="w-3 h-3" /> Locked
                              </Badge>
                            ) : u.is_active ? (
                              <Badge variant="success" className="w-fit text-xs">{t('common.active')}</Badge>
                            ) : (
                              <Badge variant="danger" className="w-fit text-xs">{t('common.inactive')}</Badge>
                            )}
                            {u.failed_login_attempts > 0 && !locked && (
                              <span className="text-xs text-orange-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {u.failed_login_attempts} failed
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingUser(u)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <div className="relative">
                              <button
                                onClick={() => setActionMenuUserId(actionMenuUserId === u.id ? null : u.id)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {actionMenuUserId === u.id && (
                                <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-gray-200 z-20 w-48 py-1">
                                  <button
                                    onClick={() => { setResetPasswordUser(u); setActionMenuUserId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-gray-700"
                                  >
                                    <Key className="w-4 h-4 text-blue-500" /> {t('users.resetPassword')}
                                  </button>
                                  {locked && (
                                    <button
                                      onClick={() => handleUnlock(u)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-green-50 text-green-700"
                                    >
                                      <Unlock className="w-4 h-4" /> {t('users.unlock')}
                                    </button>
                                  )}
                                  {!isCurrentUser && (
                                    <button
                                      onClick={() => { setDeletingUser(u); setActionMenuUserId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-red-50 text-red-600 border-t border-gray-100 mt-1"
                                    >
                                      <XCircle className="w-4 h-4" /> {t('users.deactivate')}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {t('common.page')} {page} {t('common.of')} {totalPages} · {total} {t('common.total')}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  {t('common.previous')}
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 text-sm rounded-lg ${page === p ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <UserModal roles={roles} onSave={handleCreate} onClose={() => setShowCreateModal(false)} />
      )}
      {editingUser && (
        <UserModal user={editingUser} roles={roles} onSave={handleUpdate} onClose={() => setEditingUser(null)} />
      )}
      {deletingUser && (
        <DeleteModal user={deletingUser} onConfirm={handleDelete} onClose={() => setDeletingUser(null)} />
      )}
      {resetPasswordUser && (
        <ResetPasswordModal user={resetPasswordUser} onSave={handleResetPassword} onClose={() => setResetPasswordUser(null)} />
      )}

      <ToastContainer toasts={toasts} onRemove={id => setToasts(p => p.filter(t => t.id !== id))} />

      {actionMenuUserId && (
        <div className="fixed inset-0 z-10" onClick={() => setActionMenuUserId(null)} />
      )}
    </MainLayout>
  );
}
