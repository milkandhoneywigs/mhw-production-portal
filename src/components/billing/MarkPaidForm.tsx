'use client';
import { useState, useTransition } from 'react';
import { markInvoicePaid } from '@/app/actions/invoices';
import { uploadToOrder } from '@/components/supplier/FileUpload';
import type { PaymentMethod } from '@/lib/types';

// Records a manual payment against an invoice. The transfer itself happens
// outside the portal — this stores method + reference and (optionally) the
// transfer receipt, which the supplier sees on their Payments screen.
export function MarkPaidForm({ invoiceId, orderId }: { invoiceId: string; orderId: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<File | null>(null);

  if (!open) return <button className="btn-primary text-xs" onClick={() => setOpen(true)}>Mark paid</button>;

  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => {
        let receipt_path: string | undefined;
        if (receipt) {
          const { path, error } = await uploadToOrder(orderId, receipt);
          if (error || !path) { setErr(`Receipt upload failed: ${error}`); return; }
          receipt_path = path;
        }
        const res = await markInvoicePaid(invoiceId, {
          payment_method: fd.get('payment_method') as PaymentMethod,
          payment_reference: fd.get('payment_reference')?.toString() || undefined,
          receipt_path,
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
      <label className="btn-secondary text-xs cursor-pointer">
        {receipt ? `📎 ${receipt.name}` : 'Attach transfer receipt…'}
        <input type="file" className="hidden" accept="image/*,application/pdf"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
      </label>
      <button className="btn-primary text-xs" disabled={pending}>{pending ? 'Saving…' : 'Confirm paid'}</button>
      <button type="button" className="btn-secondary text-xs" onClick={() => setOpen(false)}>Cancel</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </form>
  );
}
