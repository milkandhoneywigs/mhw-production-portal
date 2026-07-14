'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewInvoice } from '@/app/actions/invoices';

// Admin review of a supplier-submitted invoice: approve or request changes.
export function ReviewInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [changes, setChanges] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const run = (decision: 'approve' | 'changes') =>
    start(async () => {
      const res = await reviewInvoice(invoiceId, decision, notes || undefined);
      if (res.error) { setError(res.error); return; }
      setChanges(false); setNotes('');
      router.refresh();
    });

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <button className="btn-primary text-xs" disabled={pending} onClick={() => run('approve')}>Approve</button>
        <button className="btn-secondary text-xs" disabled={pending} onClick={() => setChanges(!changes)}>Request changes</button>
      </div>
      {changes && (
        <div className="flex gap-1">
          <input className="input text-xs" placeholder="What needs to change?" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn-secondary text-xs whitespace-nowrap" disabled={pending || !notes.trim()} onClick={() => run('changes')}>Send</button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
