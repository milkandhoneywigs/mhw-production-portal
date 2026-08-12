'use client';
import { useState, useTransition } from 'react';
import { archiveOrder, unarchiveOrder } from '@/app/actions/orders';

// Archive = "remove from portal" but reversible. Archived orders drop out of every
// active view; Restore brings them back. One-step for archive (with a reason note),
// one-click for restore.
export function ArchiveOrderButton({ orderId, archived }: { orderId: string; archived: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (archived) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Archived (removed from portal).</span>
        <button className="btn-secondary text-xs" disabled={pending}
          onClick={() => start(async () => { const r = await unarchiveOrder(orderId); if (r?.error) setErr(r.error); })}>
          {pending ? 'Restoring…' : 'Restore to portal'}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    );
  }

  if (!confirming) {
    return <button className="btn-secondary text-xs" onClick={() => setConfirming(true)}>Archive (remove from portal)</button>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Remove from the active portal? Reversible.</span>
      <button className="btn-primary text-xs" disabled={pending}
        onClick={() => start(async () => { const r = await archiveOrder(orderId); if (r?.error) setErr(r.error); })}>
        {pending ? 'Archiving…' : 'Yes, archive'}
      </button>
      <button className="btn-secondary text-xs" onClick={() => setConfirming(false)}>Cancel</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
