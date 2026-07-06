'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Keeps a server-rendered page alive: re-fetches server data every `seconds`.
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
