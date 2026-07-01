'use client';
import { useState, useTransition } from 'react';
import { deleteOrder } from '@/app/actions/orders';

// Delete an order (staff/admin). Two-step confirm to avoid accidents.
export function DeleteOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  if (!confirming) {
    return <button className="btn-secondary text-xs text-red-600" onClick={() => setConfirming(true)}>Delete order</button>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-red-600">Delete {orderNumber}? This can't be undone.</span>
      <button className="btn-danger text-xs" disabled={pending}
        onClick={() => start(async () => { const r = await deleteOrder(orderId); if (r?.error) setErr(r.error); })}>
        {pending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button className="btn-secondary text-xs" onClick={() => setConfirming(false)}>Cancel</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
