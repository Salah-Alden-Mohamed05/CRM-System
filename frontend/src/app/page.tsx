'use client';

/**
 * Root page – bootstrap gate
 * ──────────────────────────
 * On every cold load:
 *  1. Call GET /auth/setup-status
 *  2. If { needsSetup: true }  → redirect to /setup  (first-admin bootstrap)
 *  3. If { needsSetup: false } and already logged in → /dashboard
 *  4. If { needsSetup: false } and not logged in     → /login
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { authAPI } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Wait for AuthContext to finish restoring session
    if (loading) return;

    let cancelled = false;

    const run = async () => {
      try {
        const res = await authAPI.setupStatus();
        if (cancelled) return;

        if (res.data?.needsSetup === true) {
          // No Admin exists → go to first-time setup
          router.replace('/setup');
          return;
        }
      } catch {
        // If the call fails (network/server error) fall through to normal flow
      }

      if (cancelled) return;

      // Normal flow: admin exists
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }

      setChecking(false);
    };

    run();
    return () => { cancelled = true; };
  }, [loading, isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500">{checking ? 'Checking system status…' : 'Loading…'}</p>
      </div>
    </div>
  );
}
