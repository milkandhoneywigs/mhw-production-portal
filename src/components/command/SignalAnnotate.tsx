'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { annotateSignal } from '@/app/actions/command-centre';

// Owner judgement buttons per signal: Would enter / Would not enter (+ notes).
// Highlights the chosen call; writes straight onto score5_signals.
export function SignalAnnotate({ id, current, currentNotes }: { id: string; current: string | null; currentNotes: string | null }) {
  const [pending, start] = useTransition();
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(currentNotes ?? '');
  const router = useRouter();

  const set = (v: 'yes' | 'no') => start(async () => {
    await annotateSignal(id, current === v ? null : v); // click again to clear
    router.refresh();
  });
  const saveNotes = () => start(async () => {
    await annotateSignal(id, (current as 'yes' | 'no' | null) ?? null, notes);
    setShowNotes(false); router.refresh();
  });

  return (
    <div className="flex items-center gap-1.5 ml-auto shrink-0">
      <button onClick={() => set('yes')} disabled={pending}
        className={`text-[11px] rounded-full px-2.5 py-1 border transition ${current === 'yes'
          ? 'bg-emerald-600 text-white border-emerald-600'
          : 'border-beige text-ink/70 hover:border-emerald-400 hover:text-emerald-700'}`}>
        ✓ Would enter
      </button>
      <button onClick={() => set('no')} disabled={pending}
        className={`text-[11px] rounded-full px-2.5 py-1 border transition ${current === 'no'
          ? 'bg-red-600 text-white border-red-600'
          : 'border-beige text-ink/70 hover:border-red-400 hover:text-red-600'}`}>
        ✗ Would not
      </button>
      <button onClick={() => setShowNotes(!showNotes)}
        className={`text-[11px] rounded-full px-2 py-1 border border-beige hover:bg-sand ${currentNotes ? 'text-honey font-medium' : 'text-ink/50'}`}>
        {currentNotes ? '📝' : '+ note'}
      </button>
      {showNotes && (
        <div className="absolute right-4 mt-24 z-10 card p-3 shadow-lg w-72">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Why / why not…"
            className="w-full rounded-lg border border-beige p-2 text-xs focus:outline-none focus:ring-2 focus:ring-honey/40" />
          <div className="flex gap-2 mt-1.5">
            <button onClick={saveNotes} disabled={pending} className="text-[11px] rounded bg-ink text-cream px-2.5 py-1">Save</button>
            <button onClick={() => setShowNotes(false)} className="text-[11px] text-muted">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
