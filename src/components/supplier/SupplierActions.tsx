'use client';
import { useState, useTransition } from 'react';
import {
  supplierConfirmOrder, supplierMarkProductionComplete, supplierAddUpdate, supplierUploadTracking, supplierSetPrice,
} from '@/app/actions/supplier';
import { uploadInvoice } from '@/app/actions/invoices';

// Compact supplier action panel per order. Suppliers can confirm, add updates,
// mark complete, upload tracking + invoices — and nothing else. RLS backs this up.
export function SupplierActions({ orderId, isReadyMade }: { orderId: string; isReadyMade: boolean }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<null | 'update' | 'tracking' | 'invoice' | 'price'>(null);
  const [msg, setMsg] = useState('');
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setOpen(null); setMsg(''); });

  return (
    <div className="mt-3 border-t border-beige pt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {!isReadyMade && <button className="btn-secondary text-xs" disabled={pending} onClick={() => run(() => supplierConfirmOrder(orderId))}>Confirm order</button>}
        {!isReadyMade && <button className="btn-secondary text-xs" disabled={pending} onClick={() => run(() => supplierMarkProductionComplete(orderId))}>Mark production complete</button>}
        <button className="btn-primary text-xs" onClick={() => setOpen(open === 'price' ? null : 'price')}>Add price</button>
        <button className="btn-secondary text-xs" onClick={() => setOpen(open === 'update' ? null : 'update')}>Add update</button>
        <button className="btn-secondary text-xs" onClick={() => setOpen(open === 'tracking' ? null : 'tracking')}>Upload tracking</button>
        <button className="btn-secondary text-xs" onClick={() => setOpen(open === 'invoice' ? null : 'invoice')}>Upload invoice</button>
      </div>

      {open === 'price' && (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => supplierSetPrice(orderId, Number(fd.get('price'))));
        }}>
          <input name="price" type="number" step="0.01" min="0" className="input text-sm w-32" placeholder="Total price $" required />
          <button className="btn-primary text-xs" disabled={pending}>Add price &rarr; creates 50% deposit invoice</button>
        </form>
      )}

      {open === 'update' && (
        <div className="space-y-2">
          <textarea className="input text-sm" rows={2} placeholder="Production update…" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button className="btn-primary text-xs" disabled={pending || !msg} onClick={() => run(() => supplierAddUpdate(orderId, 'production_update', msg))}>Send update</button>
        </div>
      )}

      {open === 'tracking' && (
        <form className="grid grid-cols-2 gap-2" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => supplierUploadTracking(orderId, {
            carrier: fd.get('carrier')!.toString(), tracking_number: fd.get('tracking_number')!.toString(),
            tracking_url: fd.get('tracking_url')?.toString() || undefined,
            tracking_type: isReadyMade ? 'supplier_to_customer' : 'supplier_to_showroom',
          }));
        }}>
          <input name="carrier" className="input text-sm" placeholder="Carrier (e.g. DHL)" required />
          <input name="tracking_number" className="input text-sm" placeholder="Tracking number" required />
          <input name="tracking_url" className="input text-sm col-span-2" placeholder="Tracking URL (optional)" />
          <button className="btn-primary text-xs col-span-2" disabled={pending}>Save tracking</button>
        </form>
      )}

      {open === 'invoice' && (
        <form className="grid grid-cols-2 gap-2" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => uploadInvoice(orderId, {
            invoice_type: (fd.get('invoice_type')!.toString()) as 'initial' | 'balance' | 'other',
            invoice_number: fd.get('invoice_number')?.toString() || undefined,
            amount: fd.get('amount') ? Number(fd.get('amount')) : undefined,
            file_url: fd.get('file_url')?.toString() || undefined,
          }));
        }}>
          <select name="invoice_type" className="input text-sm"><option value="initial">Initial</option><option value="balance">Balance</option><option value="other">Other</option></select>
          <input name="invoice_number" className="input text-sm" placeholder="Invoice number" />
          <input name="amount" type="number" step="0.01" className="input text-sm" placeholder="Amount" />
          <input name="file_url" className="input text-sm" placeholder="File URL" />
          <button className="btn-primary text-xs col-span-2" disabled={pending}>Upload invoice</button>
        </form>
      )}
      {pending && <p className="text-xs text-muted">Saving…</p>}
    </div>
  );
}
