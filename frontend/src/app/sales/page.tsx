'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /sales → redirect to Sales Workspace (unified pipeline)
 * The workspace is the single entry point for the entire sales flow.
 */
export default function SalesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/sales/workspace');
  }, [router]);
  return null;
}
