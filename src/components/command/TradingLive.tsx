'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Hands-off live board. Three layers so a new signal can never require a manual
// reload: (1) Realtime websocket -> instant refresh on insert/update;
// (2) 8s polling sweep as the guaranteed floor; (3) refresh the moment the tab
// regains focus. Server components re-render via router.refresh().
export function TradingLive() {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - last.current < 2000) return; // debounce bursts
      last.current = now;
      router.refresh();
    };

    const sb = createClient();
    const ch = sb
      .channel('score5-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score5_signals' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score5_outcomes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_trades' }, refresh)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    const poll = setInterval(refresh, 8000);           // guaranteed floor
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);

    return () => {
      sb.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-honey'} animate-pulse`} />
      {live ? 'live — instant updates' : 'live — 8s sweep'}
    </span>
  );
}
