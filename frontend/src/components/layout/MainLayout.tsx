'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, TrendingUp, Package, HeadphonesIcon,
  DollarSign, BarChart2, LogOut, Menu, X, ChevronDown, Bell,
  Settings, Truck, Globe, ShieldCheck, ClipboardList,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const pathname = usePathname();
  const { user, logout, language, setLanguage } = useAuth();
  const { t, isRTL } = useTranslation();

  const isAdmin = user?.role === 'Admin';

  const navItems = [
    { href: '/dashboard',  label: t('nav.dashboard'),  icon: LayoutDashboard },
    { href: '/customers',  label: t('nav.customers'),  icon: Users },
    { href: '/sales',      label: t('nav.sales'),      icon: TrendingUp },
    { href: '/shipments',  label: t('nav.shipments'),  icon: Package },
    { href: '/tickets',    label: t('nav.support'),    icon: HeadphonesIcon },
    { href: '/finance',    label: t('nav.finance'),    icon: DollarSign },
    { href: '/reports',    label: t('nav.reports'),    icon: BarChart2 },
    { href: '/settings',   label: t('nav.settings'),   icon: Settings },
  ];

  const adminItems = [
    { href: '/admin/users',          label: t('nav.adminUsers'),  icon: ShieldCheck },
    { href: '/admin/activity-logs',  label: t('nav.adminLogs'),   icon: ClipboardList },
  ];

  // Auto-expand admin section when visiting an admin page
  const isAdminPage = pathname.startsWith('/admin');

  return (
    <div className={`flex h-screen bg-gray-50 overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 bg-slate-900 flex flex-col flex-shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-white font-bold text-sm leading-tight">Logistics</p>
              <p className="text-blue-400 text-xs">CRM System</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors group ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
              </Link>
            );
          })}

          {/* Admin Section */}
          {isAdmin && (
            <div className="mt-2">
              {sidebarOpen ? (
                <>
                  <button
                    onClick={() => setAdminExpanded(!adminExpanded)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                      isAdminPage
                        ? 'text-yellow-400 bg-slate-800'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium flex-1 text-left">{t('nav.admin')}</span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${adminExpanded || isAdminPage ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {(adminExpanded || isAdminPage) && (
                    <div className="ml-4 border-l border-slate-700 pl-2">
                      {adminItems.map(({ href, label, icon: Icon }) => {
                        const active = pathname === href;
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors text-sm ${
                              active
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium">{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                adminItems.map(({ href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center justify-center p-2 rounded-lg mb-1 transition-colors ${
                      pathname === href
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                ))
              )}
            </div>
          )}
        </nav>

        {/* Bottom user info */}
        <div className="p-4 border-t border-slate-700">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-slate-400 text-xs truncate">{user?.role}</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mx-auto">
              {user?.firstName?.[0]}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-gray-400">
              <Globe className="w-4 h-4" />
              <span className="text-sm text-gray-500">Logistics CRM</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              title="Switch language"
            >
              <Globe className="w-4 h-4" />
              <span className="font-medium">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>

            <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            <Link
              href="/settings"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </Link>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <span className="text-sm font-medium text-gray-700">{user?.firstName}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-50`}>
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {user?.role}
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="p-1 border-b border-gray-100">
                        <Link
                          href="/admin/users"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                        >
                          <ShieldCheck className="w-4 h-4 text-yellow-600" />
                          {t('nav.adminUsers')}
                        </Link>
                        <Link
                          href="/admin/activity-logs"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
                        >
                          <ClipboardList className="w-4 h-4 text-purple-600" />
                          {t('nav.adminLogs')}
                        </Link>
                      </div>
                    )}

                    <div className="p-1">
                      <button
                        onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
