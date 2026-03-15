'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /deals → redirect to Sales Workspace (unified pipeline)
 * Individual deal details are still accessible at /deals/[id]
 */
export default function DealsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/sales/workspace');
  }, [router]);
  return null;
}
