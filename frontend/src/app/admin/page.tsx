'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect /admin → /admin/users
export default function AdminRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/users'); }, [router]);
  return null;
}
