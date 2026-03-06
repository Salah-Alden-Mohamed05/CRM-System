'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, TrendingUp, Package, HeadphonesIcon,
  DollarSign, BarChart2, LogOut, Menu, X, ChevronDown, Bell,
  Settings, Truck, Globe, ShieldCheck, ClipboardList,
  ChevronRight, ClipboardCheck, Briefcase, FileText, FileCheck, Paperclip
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/i18n';

interface NavItem {
  href: string;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  roles?: string[]; // undefined = all roles; array = specific roles only
  badge?: string;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const { user, logout, language, setLanguage } = useAuth();
  const { t, isRTL } = useTranslation();

  const isAdmin    = user?.role === 'Admin';
  const isSales    = user?.role === 'Sales';

  // Detect mobile
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on mobile after navigation
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  const allNavItems: NavItem[] = [
    {
      href: '/dashboard',
      label: t('nav.dashboard'),
      labelAr: 'لوحة التحكم',
      icon: LayoutDashboard,
    },
    {
      href: '/customers',
      label: t('nav.customers'),
      labelAr: 'العملاء',
      icon: Users,
      roles: ['Admin', 'Sales', 'Operations', 'Support'],
    },
    {
      href: '/sales',
      label: t('nav.sales'),
      labelAr: 'المبيعات (Opportunities)',
      icon: TrendingUp,
      roles: ['Admin', 'Sales'],
    },
    {
      href: '/deals',
      label: 'Deals Pipeline',
      labelAr: 'خط الصفقات',
      icon: Briefcase,
      roles: ['Admin', 'Sales', 'Operations', 'Finance'],
    },
    {
      href: '/rfqs',
      label: 'RFQs',
      labelAr: 'طلبات التسعير',
      icon: FileText,
      roles: ['Admin', 'Sales', 'Operations', 'Finance'],
    },
    {
      href: '/quotations',
      label: 'Quotations',
      labelAr: 'عروض الأسعار',
      icon: FileCheck,
      roles: ['Admin', 'Finance', 'Operations', 'Sales'],
    },
    {
      href: '/tasks',
      label: 'Tasks & Log',
      labelAr: 'سجل المهام',
      icon: ClipboardCheck,
      // visible to all roles
    },
    {
      href: '/documents',
      label: 'Documents',
      labelAr: 'المستندات',
      icon: Paperclip,
      roles: ['Admin', 'Sales', 'Operations', 'Finance'],
    },
    {
      href: '/shipments',
      label: t('nav.shipments'),
      labelAr: 'الشحنات',
      icon: Package,
      roles: ['Admin', 'Operations', 'Sales'],
    },
    {
      href: '/tickets',
      label: t('nav.support'),
      labelAr: 'الدعم',
      icon: HeadphonesIcon,
      roles: ['Admin', 'Support', 'Operations'],
    },
    {
      href: '/finance',
      label: t('nav.finance'),
      labelAr: 'المالية',
      icon: DollarSign,
      roles: ['Admin', 'Finance'],
    },
    {
      href: '/reports',
      label: t('nav.reports'),
      labelAr: 'التقارير',
      icon: BarChart2,
      roles: ['Admin', 'Finance', 'Sales'],
    },
    {
      href: '/settings',
      label: t('nav.settings'),
      labelAr: 'الإعدادات',
      icon: Settings,
    },
  ];

  const adminItems = [
    { href: '/admin/users',         label: t('nav.adminUsers'), labelAr: 'إدارة المستخدمين', icon: ShieldCheck },
    { href: '/admin/activity-logs', label: t('nav.adminLogs'),  labelAr: 'سجل النشاط',        icon: ClipboardList },
  ];

  // Filter nav items by role
  const navItems = allNavItems.filter(item => {
    if (!item.roles) return true; // visible to all
    return item.roles.includes(user?.role || '');
  });

  const isAdminPage = pathname.startsWith('/admin');
  const dir = isRTL ? 'rtl' : 'ltr';

  // Role color for badge
  const roleColor = {
    Admin: 'bg-red-100 text-red-700',
    Sales: 'bg-blue-100 text-blue-700',
    Operations: 'bg-green-100 text-green-700',
    Finance: 'bg-purple-100 text-purple-700',
    Support: 'bg-orange-100 text-orange-700',
  }[user?.role || ''] || 'bg-gray-100 text-gray-700';

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className={`flex h-screen bg-gray-50 overflow-hidden ${isRTL ? 'flex-row-reverse' : ''}`} dir={dir}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isMobile ? 'fixed z-30 h-full' : 'relative'}
          ${sidebarOpen ? 'w-64' : isMobile ? 'w-0 overflow-hidden' : 'w-16'}
          transition-all duration-200 bg-slate-900 flex flex-col flex-shrink-0
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-slate-700/50 ${sidebarOpen ? '' : 'justify-center'}`}>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
            <Truck className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-white font-bold text-sm leading-tight">Logistics</p>
              <p className="text-blue-400 text-xs font-medium">CRM Platform</p>
            </div>
          )}
        </div>

        {/* Role indicator */}
        {sidebarOpen && (
          <div className="px-4 py-2.5 border-b border-slate-700/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-300 text-xs font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 font-medium truncate">{user?.firstName} {user?.lastName}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleColor}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
          {/* Section label */}
          {sidebarOpen && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              {isRTL ? 'القائمة' : 'Navigation'}
            </p>
          )}

          {navItems.map(({ href, label, labelAr, icon: Icon }) => {
            const active = href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-3 rounded-lg mb-0.5 transition-all
                  ${sidebarOpen ? 'px-3 py-2.5' : 'px-2 py-2.5 justify-center'}
                  ${active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }
                `}
                title={!sidebarOpen ? (isRTL ? labelAr : label) : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="text-sm font-medium">{isRTL ? labelAr : label}</span>
                )}
              </Link>
            );
          })}

          {/* Admin Section */}
          {isAdmin && (
            <div className="mt-3">
              {sidebarOpen && (
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                  {isRTL ? 'الإدارة' : 'Administration'}
                </p>
              )}
              {sidebarOpen ? (
                <>
                  <button
                    onClick={() => setAdminExpanded(!adminExpanded)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${
                      isAdminPage
                        ? 'text-amber-400 bg-slate-800'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium flex-1 text-left">{isRTL ? 'لوحة الإدارة' : 'Admin Panel'}</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform ${adminExpanded || isAdminPage ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {(adminExpanded || isAdminPage) && (
                    <div className={`${isRTL ? 'mr-4 border-r' : 'ml-4 border-l'} border-slate-700/50 ${isRTL ? 'pr-2' : 'pl-2'}`}>
                      {adminItems.map(({ href, label, labelAr, icon: Icon }) => {
                        const active = pathname === href || pathname.startsWith(href);
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 transition-colors text-sm ${
                              active
                                ? 'bg-amber-500/10 text-amber-300'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="font-medium">{isRTL ? labelAr : label}</span>
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
                    className={`flex items-center justify-center p-2.5 rounded-lg mb-0.5 transition-colors ${
                      pathname.startsWith(href)
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </Link>
                ))
              )}
            </div>
          )}
        </nav>

        {/* Bottom: Logout */}
        <div className="p-2 border-t border-slate-700/50">
          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
            title={!sidebarOpen ? (isRTL ? 'تسجيل خروج' : 'Log Out') : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && (
              <span className="text-sm font-medium">{isRTL ? 'تسجيل خروج' : 'Log Out'}</span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb-style page title */}
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
              <Truck className="w-4 h-4 text-blue-500" />
              <span className="text-gray-300">/</span>
              <span className="font-medium text-gray-700">
                {navItems.find(n => pathname.startsWith(n.href))
                  ? (isRTL
                    ? navItems.find(n => pathname.startsWith(n.href))?.labelAr
                    : navItems.find(n => pathname.startsWith(n.href))?.label)
                  : isAdminPage
                    ? (isRTL ? 'الإدارة' : 'Administration')
                    : 'Dashboard'
                }
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors font-medium"
              title="Switch language / تغيير اللغة"
            >
              <Globe className="w-3.5 h-3.5" />
              {language === 'en' ? 'عربي' : 'English'}
            </button>

            {/* Notifications */}
            <button className="relative p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {initials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-gray-800 leading-none">{user?.firstName}</p>
                  <p className="text-xs text-gray-400 leading-none mt-0.5">{user?.role}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} top-full mt-1 w-60 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden`}>
                    {/* User info */}
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[140px]">{user?.email}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block ${roleColor}`}>
                            {user?.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick links */}
                    <div className="p-1">
                      <Link
                        href="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                        {isRTL ? 'الإعدادات' : 'Settings'}
                      </Link>

                      {(isSales || isAdmin) && (
                        <Link
                          href="/tasks"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <ClipboardCheck className="w-4 h-4 text-blue-500" />
                          {isRTL ? 'سجل المهام' : 'My Task Log'}
                        </Link>
                      )}

                      {isAdmin && (
                        <>
                          <div className="my-1 h-px bg-gray-100" />
                          <Link
                            href="/admin/users"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4 text-amber-500" />
                            {isRTL ? 'إدارة المستخدمين' : 'Manage Users'}
                          </Link>
                          <Link
                            href="/admin/activity-logs"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <ClipboardList className="w-4 h-4 text-purple-500" />
                            {isRTL ? 'سجل النشاط' : 'Activity Logs'}
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="p-1 border-t border-gray-100">
                      <button
                        onClick={() => { setUserMenuOpen(false); logout(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {isRTL ? 'تسجيل الخروج' : 'Log Out'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
