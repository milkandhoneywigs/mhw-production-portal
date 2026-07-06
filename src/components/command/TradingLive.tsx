'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// True live: subscribes to Supabase Realtime on the score-5 contract tables and
// refreshes the server view the moment the bot inserts/updates. Polling fallback
// keeps the page honest if the websocket drops.
export function TradingLive() {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const sb = createClient();
    const ch = sb
      .channel('score5-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score5_signals' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score5_outcomes' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_trades' }, () => router.refresh())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    const poll = setInterval(() => router.refresh(), 30000); // fallback
    return () => { sb.removeChannel(ch); clearInterval(poll); };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span className={`w-2 h-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
      {live ? 'realtime connected' : 'connecting… (30s polling active)'}
    </span>
  );
}
