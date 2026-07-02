'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decideModuleItem } from '@/app/actions/command-centre';

// One-click APPROVE / DENY (+ optional note) for any agent's drafted item.
// The note is stored on the item as decision_note — the agent reads it when
// implementing (or when revising a denied draft).
export function ItemApproval({ table, id }: { table: string; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  const decide = (d: 'approve' | 'reject') =>
    start(async () => {
      const res = await decideModuleItem(table, id, d, note || undefined);
      if (res.error) setErr(res.error);
      else router.refresh();
    });

  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0 w-44">
      <div className="flex gap-2">
        <button className="btn-primary text-xs" disabled={pending} onClick={() => decide('approve')}>{pending ? '…' : 'Approve'}</button>
        <button className="btn-secondary text-xs" disabled={pending} onClick={() => decide('reject')}>Deny</button>
      </div>
      {showNote ? (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="input text-xs w-full"
          placeholder="Note for the agent (sent with your decision)…"
        />
      ) : (
        <button type="button" className="text-[11px] text-honey hover:underline" onClick={() => setShowNote(true)}>+ Add note</button>
      )}
      {err && <p className="text-[10px] text-red-600">{err}</p>}
    </div>
  );
}
