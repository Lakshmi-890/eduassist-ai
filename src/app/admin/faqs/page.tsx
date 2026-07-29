'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirects legacy /admin/faqs route hits to the new unified /admin?tab=faqs dashboard.
 */
export default function FaqsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin?tab=faqs');
  }, [router]);

  return null;
}
