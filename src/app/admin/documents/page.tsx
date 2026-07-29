'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects legacy /admin/documents route hits to the new unified /admin?tab=documents dashboard.
 */
export default function DocumentsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin?tab=documents');
  }, [router]);

  return null;
}
