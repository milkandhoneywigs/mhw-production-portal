'use client';
import { useState, useTransition } from 'react';
import { markInvoicePaid } from '@/app/actions/invoices';
import type { PaymentMethod } from '@/lib/types';

// Records a manual payment against an invoice. The transfer itself happens
// outside the portal — this only stores method + reference + paid date.
export function MarkPaidForm({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return <button className="btn-primary text-xs" onClick={() => setOpen(true)}>Mark paid</button>;

  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => {
        const res = await markInvoicePaid(invoiceId, {
          payment_method: fd.get('payment_method') as PaymentMethod,
          payment_reference: fd.get('payment_reference')?.toString() || undefined,
        });
        if (res?.error) setErr(res.error); else setOpen(false);
      });
    }}>
      <select name="payment_method" className="input text-xs w-32">
        <option value="bank_transfer">Bank transfer</option>
        <option value="paypal">PayPal</option>
        <option value="other">Other</option>
      </select>
      <input name="payment_reference" className="input text-xs w-40" placeholder="Payment reference" />
      <button className="btn-primary text-xs" disabled={pending}>{pending ? 'Saving…' : 'Confirm paid'}</button>
      <button type="button" className="btn-secondary text-xs" onClick={() => setOpen(false)}>Cancel</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </form>
  );
}
