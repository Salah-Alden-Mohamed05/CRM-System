'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { authAPI } from '@/lib/api';
import { Loading, Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import {
  Users, Shield, Settings, Plus, Edit2, Search,
  CheckCircle, XCircle, Key, Mail, User, Calendar
} from 'lucide-react';
import { format } from 'date-fns';

const roleColors: Record<string, string> = {
  Admin: 'bg-red-100 text-red-700',
  Sales: 'bg-blue-100 text-blue-700',
  Operations: 'bg-green-100 text-green-700',
  Finance: 'bg-purple-100 text-purple-700',
  Support: 'bg-orange-100 text-orange-700',
};

type Tab = 'users' | 'roles' | 'profile';

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [roles, setRoles] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role_id: '',
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    loadData();
    if (currentUser) {
      setProfileForm({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        email: currentUser.email || '',
      });
    }
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.allSettled([
        authAPI.getUsers(),
        authAPI.getRoles(),
      ]);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data.data || []);
      if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      await authAPI.createUser({
        firstName: createForm.first_name,
        lastName:  createForm.last_name,
        email:     createForm.email,
        password:  createForm.password,
        roleId:    createForm.role_id,
        isActive:  true,
      });
      setShowCreateModal(false);
      setCreateForm({ first_name: '', last_name: '', email: '', password: '', role_id: '' });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredUsers = users.filter(u => {
    const user = u as Record<string, unknown>;
    const q = searchQuery.toLowerCase();
    return (
      String(user.first_name || '').toLowerCase().includes(q) ||
      String(user.last_name || '').toLowerCase().includes(q) ||
      String(user.email || '').toLowerCase().includes(q) ||
      String(user.role_name || '').toLowerCase().includes(q)
    );
  });

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield },
    { id: 'profile', label: 'My Profile', icon: Settings },
  ];

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage users, roles, and system configuration</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {currentUser?.role === 'Admin' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loading /></div>
            ) : (
              <Card className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['User', 'Role', 'Status', 'Last Login', 'Created', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map(u => {
                      const userRow = u as Record<string, unknown>;
                      return (
                        <tr key={String(userRow.id)} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-blue-700">
                                  {String(userRow.first_name || 'U').charAt(0)}{String(userRow.last_name || '').charAt(0)}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {String(userRow.first_name || '')} {String(userRow.last_name || '')}
                                </p>
                                <p className="text-xs text-gray-500">{String(userRow.email || '')}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={roleColors[String(userRow.role_name || '')] || 'bg-gray-100 text-gray-700'}>
                              {String(userRow.role_name || '')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {userRow.is_active ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                  <span className="text-xs text-green-700">Active</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 text-red-400" />
                                  <span className="text-xs text-red-600">Inactive</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {userRow.last_login
                              ? format(new Date(String(userRow.last_login)), 'dd MMM yyyy')
                              : 'Never'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {userRow.created_at ? format(new Date(String(userRow.created_at)), 'dd MMM yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {currentUser?.role === 'Admin' && (
                              <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No users found</p>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map(role => {
                const r = role as Record<string, unknown>;
                const permissions: Record<string, string[]> = {
                  Admin: ['Full system access', 'User management', 'All modules', 'Reports & Analytics', 'System configuration'],
                  Sales: ['Customer management', 'Opportunities & Leads', 'Sales Pipeline', 'Activity logging', 'Basic reports'],
                  Operations: ['Shipment management', 'Milestone tracking', 'Customer view (read)', 'Delay management', 'Operations reports'],
                  Finance: ['Invoice management', 'Payment tracking', 'Financial reports', 'Cost management', 'Customer view (read)'],
                  Support: ['Ticket management', 'Customer view', 'Shipment view (read)', 'SLA tracking', 'Support reports'],
                };
                const perms = permissions[String(r.name || '')] || [];
                return (
                  <Card key={String(r.id)} className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-blue-500" />
                      <h3 className="font-semibold text-gray-900">{String(r.name || '')}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{String(r.description || '')}</p>
                    <div className="space-y-1">
                      {perms.map((perm, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          {perm}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        {users.filter(u => (u as Record<string, unknown>).role_name === r.name).length} user(s)
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-700">
                    {String(currentUser?.first_name || 'U').charAt(0)}{String(currentUser?.last_name || '').charAt(0)}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {currentUser?.first_name} {currentUser?.last_name}
                  </h2>
                  <Badge className={roleColors[currentUser?.role || ''] || 'bg-gray-100 text-gray-700'}>
                    {currentUser?.role}
                  </Badge>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-4">Profile Information</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'first_name', label: 'First Name', icon: User },
                  { key: 'last_name', label: 'Last Name', icon: User },
                  { key: 'email', label: 'Email Address', icon: Mail },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className={key === 'email' ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <span className="flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-gray-400" />
                        {label}
                      </span>
                    </label>
                    <input
                      value={profileForm[key as keyof typeof profileForm] || ''}
                      onChange={e => setProfileForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              {saveSuccess && (
                <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" /> Profile updated successfully
                </div>
              )}
              {saveError && (
                <div className="mt-4 text-red-600 text-sm">{saveError}</div>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    setSaveSuccess(true);
                    setSaveError('');
                    setTimeout(() => setSaveSuccess(false), 3000);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400" />
                Change Password
              </h3>
              <div className="space-y-4">
                {[
                  { key: 'current_password', label: 'Current Password' },
                  { key: 'new_password', label: 'New Password' },
                  { key: 'confirm_password', label: 'Confirm New Password' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      type="password"
                      value={passwordForm[key as keyof typeof passwordForm] || ''}
                      onChange={e => setPasswordForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  Update Password
                </button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                Account Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Role</span>
                  <Badge className={roleColors[currentUser?.role || ''] || ''}>{currentUser?.role}</Badge>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Member since</span>
                  <span className="text-gray-900 font-medium">
                    {currentUser ? format(new Date(), 'MMM yyyy') : '—'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Status</span>
                  <div className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Active</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Create New User</h2>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: 'first_name', label: 'First Name', type: 'text' },
                { key: 'last_name', label: 'Last Name', type: 'text' },
                { key: 'email', label: 'Email Address', type: 'email' },
                { key: 'password', label: 'Password', type: 'password' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={createForm[key as keyof typeof createForm]}
                    onChange={e => setCreateForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={createForm.role_id}
                  onChange={e => setCreateForm(prev => ({ ...prev, role_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select role...</option>
                  {roles.map(r => (
                    <option key={String((r as Record<string, unknown>).id)} value={String((r as Record<string, unknown>).id)}>
                      {String((r as Record<string, unknown>).name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
