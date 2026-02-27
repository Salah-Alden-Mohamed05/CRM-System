'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Truck, Lock, Mail, Globe, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const { login, language, setLanguage } = useAuth();
  const router = useRouter();

  const isAr = language === 'ar';

  const labels = {
    title: isAr ? 'تسجيل الدخول' : 'Sign in to your account',
    email: isAr ? 'البريد الإلكتروني' : 'Email Address',
    password: isAr ? 'كلمة المرور' : 'Password',
    rememberMe: isAr ? 'تذكرني لمدة 30 يوماً' : 'Remember me for 30 days',
    signIn: isAr ? 'تسجيل الدخول' : 'Sign In',
    signingIn: isAr ? 'جارٍ تسجيل الدخول…' : 'Signing in…',
    demoAccounts: isAr ? 'حسابات تجريبية' : 'Quick Demo Access',
    switchLang: isAr ? 'EN' : 'AR',
  };

  const demoAccounts = [
    { label: 'Admin',   email: 'admin@logisticscrm.com',   password: 'Admin@1234',   color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    { label: 'Sales',   email: 'sales@logisticscrm.com',   password: 'Sales@1234',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { label: 'Ops',     email: 'ops@logisticscrm.com',     password: 'Ops@1234',     color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    { label: 'Finance', email: 'finance@logisticscrm.com', password: 'Finance@1234', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    { label: 'Support', email: 'support@logisticscrm.com', password: 'Support@1234', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  ];

  const doLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    setIsLocked(false);
    try {
      await login(email, password, rememberMe);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string }; status?: number } };
      const msg = axiosErr?.response?.data?.message || (isAr ? 'فشل تسجيل الدخول' : 'Login failed');
      const status = axiosErr?.response?.status;
      setError(msg);
      if (status === 423) setIsLocked(true);
    } finally {
      setLoading(false);
    }
  };

  const loginAs = async (acc: typeof demoAccounts[0]) => {
    setLoading(true);
    setError('');
    setIsLocked(false);
    try {
      await login(acc.email, acc.password, false);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Language toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white hover:bg-white/20 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span className="font-medium">{labels.switchLang}</span>
          </button>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl mb-4">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Logistics CRM</h1>
          <p className="text-blue-300 mt-1">International Freight Management</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">{labels.title}</h2>

          {/* Error message */}
          {error && (
            <div className={`mb-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
              isLocked
                ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
                : 'bg-red-500/20 border border-red-500/30 text-red-300'
            }`}>
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={doLogin} className="space-y-4" autoComplete="on">
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-blue-200 block mb-1">{labels.email}</label>
              <div className="relative">
                <Mail className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className={`w-full ${isAr ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-blue-200 block mb-1">{labels.password}</label>
              <div className="relative">
                <Lock className={`absolute ${isAr ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`w-full ${isAr ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-white`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-blue-500 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-blue-200 cursor-pointer select-none">
                {labels.rememberMe}
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {labels.signingIn}
                </>
              ) : labels.signIn}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-slate-400 mb-3 text-center font-medium">{labels.demoAccounts}</p>
            <div className="grid grid-cols-5 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.label}
                  onClick={() => loginAs(acc)}
                  disabled={loading}
                  className={`px-2 py-1.5 text-xs rounded-lg transition-colors font-medium border ${acc.color} hover:brightness-110 disabled:opacity-50`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              Passwords: Role@1234 (e.g. Admin@1234)
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          © {new Date().getFullYear()} Logistics CRM · Secure Authentication
        </p>
      </div>
    </div>
  );
}
