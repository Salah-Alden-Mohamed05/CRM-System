'use client';

/**
 * Login / Landing Page
 * ────────────────────
 * Single-company CRM Login
 * ─────────────────────────
 *  1. "Create Admin Account" – First-time setup (only when no admin exists)
 *  2. "Sign In"              – For all users
 *
 * Flow:
 *  • If needsSetup=true  → Create Admin form is available
 *  • If needsSetup=false → Admin exists; employees sign in normally
 *  • The Admin creates employee accounts from the Admin panel.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/lib/api';
import {
  Eye, EyeOff, Truck, Lock, Mail, Globe, AlertTriangle,
  ShieldCheck, LogIn, ChevronRight, Users, Building2,
  CheckCircle2, ArrowLeft, Info, UserCheck, RefreshCw
} from 'lucide-react';

type PageMode = 'landing' | 'login' | 'setup';

export default function LoginPage() {
  const router = useRouter();
  const { login, language, setLanguage } = useAuth();

  // ── State ────────────────────────────────────────────────
  const [mode, setMode] = useState<PageMode>('landing');
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Setup form
  const [setupForm, setSetupForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: ''
  });
  const [showSetupPass, setShowSetupPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupDone, setSetupDone] = useState(false);

  const isAr = language === 'ar';

  // ── Check setup status on mount ──────────────────────────
  useEffect(() => {
    authAPI.setupStatus()
      .then(res => {
        setNeedsSetup(res.data?.needsSetup === true);
        setCheckingSetup(false);
      })
      .catch(() => {
        setNeedsSetup(false);
        setCheckingSetup(false);
      });
  }, []);

  // ── Password strength ────────────────────────────────────
  const passwordStrength = (() => {
    const p = setupForm.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();
  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const strengthLabels = isAr
    ? ['', 'ضعيف جداً', 'ضعيف', 'مقبول', 'جيد', 'قوي']
    : ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  // ── Login handler ────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLocked(false);
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword, rememberMe);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string }; status?: number } };
      setLoginError(axErr?.response?.data?.message || (isAr ? 'فشل تسجيل الدخول' : 'Login failed'));
      if (axErr?.response?.status === 423) setIsLocked(true);
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Setup handler ────────────────────────────────────────
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    if (setupForm.password !== setupForm.confirmPassword) {
      setSetupError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    if (setupForm.password.length < 8) {
      setSetupError(isAr ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    setSetupLoading(true);
    try {
      await authAPI.setupAdmin({
        email: setupForm.email,
        password: setupForm.password,
        firstName: setupForm.firstName,
        lastName: setupForm.lastName,
        phone: setupForm.phone || undefined,
      });
      setSetupDone(true);
      // Redirect to login after short delay
      setTimeout(() => {
        setNeedsSetup(false);
        setMode('login');
        setSetupDone(false);
        setLoginEmail(setupForm.email);
        setSetupForm({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', phone: '' });
      }, 2500);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string } } };
      setSetupError(axErr?.response?.data?.message || (isAr ? 'فشل إنشاء الحساب' : 'Failed to create account'));
    } finally {
      setSetupLoading(false);
    }
  };

  // ── Quick demo login ──────────────────────────────────────
  const demoAccounts = [
    { label: 'Admin',   email: 'admin@logisticscrm.com',   password: 'Admin@1234',   color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    { label: 'Sales',   email: 'sales@logisticscrm.com',   password: 'Sales@1234',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { label: 'Ops',     email: 'ops@logisticscrm.com',     password: 'Ops@1234',     color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    { label: 'Finance', email: 'finance@logisticscrm.com', password: 'Finance@1234', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    { label: 'Support', email: 'support@logisticscrm.com', password: 'Support@1234', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  ];

  const loginAs = async (acc: typeof demoAccounts[0]) => {
    setLoginLoading(true);
    setLoginError('');
    try {
      await login(acc.email, acc.password, false);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { message?: string } } };
      setLoginError(axErr?.response?.data?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Shared page wrapper ──────────────────────────────────
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Language toggle */}
        <div className={`flex ${isAr ? 'justify-start' : 'justify-end'} mb-4`}>
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white hover:bg-white/20 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span className="font-medium">{isAr ? 'EN' : 'AR'}</span>
          </button>
        </div>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Logistics CRM</h1>
          <p className="text-blue-300 mt-1 text-sm">
            {isAr ? 'إدارة الشحن الدولي' : 'International Freight Management'}
          </p>
        </div>

        {children}

        <p className="text-center text-slate-500 text-xs mt-6">
          © {new Date().getFullYear()} Logistics CRM
          {isAr ? ' · مصادقة آمنة' : ' · Secure Authentication'}
        </p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════
  // LANDING PAGE – Always shows TWO options
  // ══════════════════════════════════════════════
  if (mode === 'landing') {
    return (
      <Wrapper>
        <div className="space-y-4">

          {/* ── Create Admin Card ─────────────────────── */}
          <div
            onClick={() => {
              if (checkingSetup) return;
              if (needsSetup === true) {
                setMode('setup');
              } else {
                // Admin already exists – navigate to setup anyway to show message
                setMode('setup');
              }
            }}
            className={`group w-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/40 hover:border-amber-400/70 rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer ${checkingSetup ? 'opacity-60 cursor-wait' : ''}`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                <ShieldCheck className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-lg">
                    {isAr ? 'إنشاء حساب مدير' : 'Create Admin Account'}
                  </h3>
                  <ChevronRight className={`w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-amber-200/70 text-sm mt-1">
                  {checkingSetup
                    ? (isAr ? 'جارٍ التحقق...' : 'Checking…')
                    : needsSetup
                      ? (isAr ? 'أول استخدام؟ أنشئ حساب المدير' : 'First time? Create the Admin account')
                      : (isAr ? 'إضافة مدير جديد للنظام' : 'Add a new administrator to the system')}
                </p>
                <div className="mt-3">
                  {checkingSetup ? (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full border border-white/20">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {isAr ? 'جارٍ التحقق...' : 'Checking…'}
                    </span>
                  ) : needsSetup ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                      {isAr ? 'الإعداد الأول مطلوب' : 'First-time setup required'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">
                      <UserCheck className="w-3 h-3" />
                      {isAr ? 'النظام جاهز' : 'System is ready'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Sign In Card ──────────────────────────── */}
          <div
            onClick={() => { if (!checkingSetup) { setMode('login'); setLoginError(''); } }}
            className={`group w-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-2 border-blue-500/40 hover:border-blue-400/70 rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer ${checkingSetup ? 'opacity-60 cursor-wait' : ''}`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                <LogIn className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-lg">
                    {isAr ? 'تسجيل الدخول' : 'Sign In'}
                  </h3>
                  <ChevronRight className={`w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-blue-200/70 text-sm mt-1">
                  {isAr
                    ? 'لديك حساب؟ سجّل دخولك للمتابعة'
                    : 'Already have an account? Sign in to continue'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(isAr
                    ? ['المدير', 'المبيعات', 'العمليات', 'المالية', 'الدعم']
                    : ['Admin', 'Sales', 'Ops', 'Finance', 'Support']
                  ).map(r => (
                    <span key={r} className="text-xs bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── How It Works ──────────────────────────── */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-slate-300 text-sm font-medium mb-2">
                  {isAr ? 'كيف يعمل النظام؟' : 'How does it work?'}
                </p>
                <ul className="text-slate-400 text-xs space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                    <span>{isAr ? 'المدير ينشئ الحساب الأول (إعداد أولي للنظام)' : 'Admin creates the first account (one-time setup)'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                    <span>{isAr ? 'المدير يضيف حسابات الموظفين من لوحة الإدارة' : 'Admin adds employee accounts from the Admin panel'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                    <span>{isAr ? 'الموظفون يسجلون الدخول باستخدام بياناتهم' : 'Employees sign in with their credentials'}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </Wrapper>
    );
  }

  // ══════════════════════════════════════════════
  // SETUP PAGE – Create Admin Account
  // ══════════════════════════════════════════════
  if (mode === 'setup') {
    // Success screen
    if (setupDone) {
      return (
        <Wrapper>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {isAr ? 'تم إنشاء حساب المدير!' : 'Admin Account Created!'}
            </h2>
            <p className="text-blue-200 text-sm mb-6">
              {isAr
                ? 'جارٍ توجيهك إلى صفحة تسجيل الدخول...'
                : 'Redirecting you to sign in…'}
            </p>
            <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto" />
          </div>
        </Wrapper>
      );
    }

    // Admin already exists – show info message instead of form
    if (needsSetup === false) {
      return (
        <Wrapper>
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
            {/* Back button */}
            <button
              onClick={() => { setMode('landing'); setSetupError(''); }}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors text-sm"
            >
              <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
              {isAr ? 'رجوع' : 'Back'}
            </button>

            <div className="text-center py-4">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                {isAr ? 'النظام جاهز' : 'System Already Set Up'}
              </h2>
              <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                {isAr
                  ? 'يوجد بالفعل حساب مدير في هذا النظام.\nيمكنك تسجيل الدخول بحسابك، أو تواصل مع المدير لإنشاء حساب جديد.'
                  : 'An administrator account already exists for this system. Please sign in with your account, or contact the system administrator to create a new employee account.'}
              </p>

              {/* Info box */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200 leading-relaxed">
                    {isAr ? (
                      <>
                        <p className="font-medium mb-1">كيف يعمل النظام؟</p>
                        <p>المدير هو أول شخص يُسجَّل في النظام، ثم يضيف موظفيه من لوحة الإدارة. كل موظف يرى بياناته الخاصة فقط.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium mb-1">Single-company CRM:</p>
                        <p>The Admin creates the first account, then adds all employees via the Admin panel. Each employee sees only their own assigned data.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => { setMode('login'); setSetupError(''); }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                {isAr ? 'تسجيل الدخول' : 'Go to Sign In'}
              </button>
            </div>
          </div>
        </Wrapper>
      );
    }

    // needsSetup === true → Show create admin form
    return (
      <Wrapper>
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => { setMode('landing'); setSetupError(''); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            >
              <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isAr ? 'إنشاء حساب المدير' : 'Create Admin Account'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr ? 'الإعداد الأول للنظام' : 'First-time system setup'}
              </p>
            </div>
          </div>

          {/* Notice */}
          <div className="mb-5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex gap-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <span>
              {isAr
                ? 'ستكون أول مدير لهذا النظام. يمكنك بعد ذلك إضافة حسابات الموظفين من لوحة الإدارة.'
                : 'You will be the first administrator. After setup, add employee accounts from the Admin panel.'}
            </span>
          </div>

          {/* Error */}
          {setupError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-sm text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{setupError}</span>
            </div>
          )}

          <form onSubmit={handleSetup} className="space-y-3">
            {/* First/Last name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-blue-200 block mb-1">
                  {isAr ? 'الاسم الأول *' : 'First Name *'}
                </label>
                <input
                  type="text"
                  value={setupForm.firstName}
                  onChange={e => setSetupForm(p => ({ ...p, firstName: e.target.value }))}
                  placeholder={isAr ? 'محمد' : 'John'}
                  required
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-blue-200 block mb-1">
                  {isAr ? 'اسم العائلة *' : 'Last Name *'}
                </label>
                <input
                  type="text"
                  value={setupForm.lastName}
                  onChange={e => setSetupForm(p => ({ ...p, lastName: e.target.value }))}
                  placeholder={isAr ? 'أحمد' : 'Doe'}
                  required
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs font-medium text-blue-200 block mb-1">
                {isAr ? 'البريد الإلكتروني *' : 'Email Address *'}
              </label>
              <div className="relative">
                <Mail className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type="email"
                  value={setupForm.email}
                  onChange={e => setSetupForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="admin@yourcompany.com"
                  required
                  className={`w-full ${isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm`}
                />
              </div>
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="text-xs font-medium text-blue-200 block mb-1">
                {isAr ? 'رقم الهاتف (اختياري)' : 'Phone Number (optional)'}
              </label>
              <input
                type="tel"
                value={setupForm.phone}
                onChange={e => setSetupForm(p => ({ ...p, phone: e.target.value }))}
                placeholder={isAr ? '+20 10 0000 0000' : '+1 234 567 8900'}
                className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-blue-200 block mb-1">
                {isAr ? 'كلمة المرور *' : 'Password *'}
              </label>
              <div className="relative">
                <Lock className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type={showSetupPass ? 'text' : 'password'}
                  value={setupForm.password}
                  onChange={e => setSetupForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={isAr ? '8 أحرف على الأقل' : 'Min. 8 characters'}
                  required minLength={8}
                  className={`w-full ${isAr ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm`}
                />
                <button type="button" onClick={() => setShowSetupPass(!showSetupPass)}
                  className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-white`}>
                  {showSetupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {setupForm.password && (
                <div className="mt-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{strengthLabels[passwordStrength]}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-xs font-medium text-blue-200 block mb-1">
                {isAr ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
              </label>
              <div className="relative">
                <Lock className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={setupForm.confirmPassword}
                  onChange={e => setSetupForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder={isAr ? 'أعد كتابة كلمة المرور' : 'Repeat your password'}
                  required
                  className={`w-full ${isAr ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-2.5 bg-white/10 border rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm ${
                    setupForm.confirmPassword && setupForm.confirmPassword !== setupForm.password
                      ? 'border-red-500/60'
                      : 'border-white/20'
                  }`}
                />
                <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-white`}>
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {setupForm.confirmPassword && setupForm.confirmPassword !== setupForm.password && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}
                </p>
              )}
              {setupForm.confirmPassword && setupForm.confirmPassword === setupForm.password && setupForm.password.length >= 8 && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {isAr ? 'كلمتا المرور متطابقتان' : 'Passwords match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={setupLoading || (!!setupForm.confirmPassword && setupForm.confirmPassword !== setupForm.password)}
              className="w-full py-3 mt-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {setupLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isAr ? 'جارٍ الإنشاء...' : 'Creating account…'}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  {isAr ? 'إنشاء حساب المدير' : 'Create Admin Account'}
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500">
              {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
              <button type="button" onClick={() => setMode('login')}
                className="text-blue-400 hover:text-blue-300 underline">
                {isAr ? 'تسجيل الدخول' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>
      </Wrapper>
    );
  }

  // ══════════════════════════════════════════════
  // LOGIN PAGE – Sign In
  // ══════════════════════════════════════════════
  return (
    <Wrapper>
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setMode('landing'); setLoginError(''); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
          >
            <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white">
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr ? 'أدخل بياناتك للمتابعة' : 'Enter your credentials to continue'}
            </p>
          </div>
        </div>

        {/* Error */}
        {loginError && (
          <div className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ${
            isLocked
              ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
              : 'bg-red-500/20 border border-red-500/30 text-red-300'
          }`}>
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4" autoComplete="on">
          {/* Email */}
          <div>
            <label className="text-sm font-medium text-blue-200 block mb-1.5">
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
              <input
                type="email" name="email" autoComplete="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder={isAr ? 'بريدك@شركتك.com' : 'you@company.com'}
                required
                className={`w-full ${isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-blue-200 block mb-1.5">
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <div className="relative">
              <Lock className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
              <input
                type={showLoginPass ? 'text' : 'password'} name="password" autoComplete="current-password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
                className={`w-full ${isAr ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
              />
              <button type="button" onClick={() => setShowLoginPass(!showLoginPass)}
                className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-white`}>
                {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox" id="rememberMe"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 accent-blue-500 cursor-pointer"
            />
            <label htmlFor="rememberMe" className="text-sm text-blue-200 cursor-pointer select-none">
              {isAr ? 'تذكرني لمدة 30 يوماً' : 'Remember me for 30 days'}
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit" disabled={loginLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loginLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isAr ? 'جارٍ تسجيل الدخول...' : 'Signing in…'}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                {isAr ? 'تسجيل الدخول' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        {/* Create Admin link (only when no admin exists yet) */}
        {needsSetup && (
          <div className="mt-4 pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-slate-400 mb-2">
              {isAr ? 'لم يتم الإعداد بعد؟' : 'Not set up yet?'}
            </p>
            <button
              onClick={() => { setMode('setup'); setSetupError(''); }}
              className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1.5 mx-auto transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              {isAr ? 'إنشاء حساب المدير' : 'Create Admin Account'}
            </button>
          </div>
        )}

        {/* Demo accounts (shown when setup is done / demo data exists) */}
        {!needsSetup && (
          <div className="mt-5 pt-5 border-t border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs text-slate-400 font-medium">
                {isAr ? 'حسابات تجريبية سريعة' : 'Quick Demo Access'}
              </p>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.label}
                  onClick={() => loginAs(acc)}
                  disabled={loginLoading}
                  className={`px-1.5 py-2 text-xs rounded-lg transition-all font-medium border ${acc.color} hover:brightness-125 disabled:opacity-50`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              {isAr
                ? 'كلمة المرور: الدور@1234 (مثال: Admin@1234)'
                : 'Password pattern: Role@1234 (e.g. Admin@1234)'}
            </p>
          </div>
        )}
      </div>
    </Wrapper>
  );
}
