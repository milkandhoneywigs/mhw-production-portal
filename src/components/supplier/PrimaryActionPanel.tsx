'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  supplierConfirmOrder, supplierSetPrice, supplierMarkReadyToDispatch,
  supplierStartProduction, supplierMarkProductionComplete, supplierAddUpdate,
  supplierUploadTracking, supplierReportDelay, supplierRequestPayment,
} from '@/app/actions/supplier';
import { uploadInvoice } from '@/app/actions/invoices';
import { ConfirmModal, toast } from './Feedback';
import { FileUpload, uploadToOrder } from './FileUpload';
import type { PrimaryAction } from '@/lib/supplier-portal';

interface OrderShape {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  supplier_price: number | null;
  shipping_destination: string | null;
  expected_completion_date: string | null;
}

// The ONE prominent action for the order's current status, plus the always-available
// secondary actions (add update / report a problem). Confirmation modals guard
// every important step; toasts confirm the outcome.
export function PrimaryActionPanel({ order, action, overdue }: {
  order: OrderShape; action: PrimaryAction | null; overdue: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [price, setPrice] = useState('');
  const [tracking, setTracking] = useState({ carrier: 'DHL', number: '', url: '' });
  const [invoice, setInvoice] = useState<{ type: 'initial' | 'balance' | 'other'; number: string; amount: string; path: string; name: string }>({ type: 'initial', number: '', amount: '', path: '', name: '' });
  const [delay, setDelay] = useState({ reason: '', date: '', message: '' });

  const run = (fn: () => Promise<{ error?: string }>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      if (res?.error) { toast(res.error, false); return; }
      toast(okMsg);
      setModal(null); setMsg('');
      router.refresh();
    });

  const isReadyMade = order.order_type === 'ready_made';
  const shipsToCustomer = isReadyMade || order.shipping_destination === 'customer_direct';

  function openPrimary() {
    if (!action) return;
    setModal(action.key);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {action && (
          <button className="btn-primary" onClick={openPrimary} disabled={pending}>
            {action.label}
          </button>
        )}
        {overdue && (
          <button
            className="rounded-lg px-3 py-2 bg-red-600 text-white text-sm font-medium hover:bg-red-700"
            onClick={() => setModal('delay')}
          >
            Report delay
          </button>
        )}
        {/* Pricing + payment are always reachable, not tied to one status. */}
        {order.supplier_price == null && action?.key !== 'add_price' && !['completed', 'cancelled'].includes(order.status) && (
          <button className="btn-secondary text-sm" onClick={() => setModal('add_price')}>Add order price</button>
        )}
        {order.supplier_price != null && !['completed', 'cancelled'].includes(order.status) && (
          <button className="btn-secondary text-sm" onClick={() => setModal('request_payment')}>💰 Request payment</button>
        )}
        <button className="btn-secondary text-sm" onClick={() => setModal('update')}>Add update</button>
        <button className="btn-secondary text-sm" onClick={() => setModal('problem')}>Report a problem</button>
      </div>
      {action && <p className="text-xs text-muted">{action.help}</p>}

      {/* Confirm order / stock */}
      <ConfirmModal
        open={modal === 'confirm'} title={isReadyMade ? 'Confirm stock' : 'Confirm this order'}
        confirmLabel={isReadyMade ? 'Yes, I have this in stock' : 'Yes, confirm order'}
        onConfirm={() => run(() => supplierConfirmOrder(order.id), 'Order confirmed. Thank you!')}
        onClose={() => setModal(null)} pending={pending}
      >
        <p>Order <b>#{order.order_number}</b>.</p>
        <p>{isReadyMade
          ? 'Please check the wig is in stock and ready to ship before confirming.'
          : 'Please check every specification before confirming you can produce this order.'}</p>
      </ConfirmModal>

      {/* Add price (with confirmation before any invoice is created) */}
      {modal === 'add_price' && (
        <div className="card p-4 space-y-3 bg-sand/40">
          <label className="label" htmlFor="price">Total price for this order — USD, including shipping</label>
          <input id="price" type="number" min="0" step="0.01" className="input w-40" value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 350.00" />
          <div className="flex gap-2">
            <button className="btn-primary text-sm" disabled={!(Number(price) > 0)} onClick={() => setModal('price_confirm')}>Continue</button>
            <button className="btn-secondary text-sm" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={modal === 'price_confirm'} title="Confirm price"
        confirmLabel="Submit price"
        onConfirm={() => run(() => supplierSetPrice(order.id, Number(price)), 'Price submitted.')}
        onClose={() => setModal(null)} pending={pending}
      >
        <p>Order <b>#{order.order_number}</b> — total price <b>${Number(price).toFixed(2)} USD (including shipping)</b>.</p>
        <p>{isReadyMade
          ? 'An invoice for 100% of this price will be sent to Milk & Honey for payment.'
          : 'A 50% deposit invoice will be sent to Milk & Honey for payment. The balance is invoiced when production is complete.'}</p>
      </ConfirmModal>

      {/* Request payment */}
      <ConfirmModal
        open={modal === 'request_payment'} title="Request payment"
        confirmLabel="Send payment request"
        onConfirm={() => run(() => supplierRequestPayment(order.id), 'Payment request sent to Milk & Honey.')}
        onClose={() => setModal(null)} pending={pending}
      >
        <p>Ask Milk &amp; Honey to arrange payment for order <b>#{order.order_number}</b>
          {order.supplier_price != null && <> (your price: <b>${Number(order.supplier_price).toFixed(2)} USD</b>)</>}?</p>
        <p>They will see your request immediately in their inbox and billing screen.</p>
      </ConfirmModal>

      {/* Ready to dispatch */}
      <ConfirmModal
        open={modal === 'ready_to_dispatch'} title="Mark ready to dispatch"
        confirmLabel="Order is packed and ready"
        onConfirm={() => run(() => supplierMarkReadyToDispatch(order.id), 'Marked ready to dispatch. Please create the DHL shipment next.')}
        onClose={() => setModal(null)} pending={pending}
      >
        <p>Order <b>#{order.order_number}</b> is packed and ready for DHL pickup?</p>
        <p>Next step: create the DHL shipment and upload the tracking number.</p>
      </ConfirmModal>

      {/* Start production */}
      <ConfirmModal
        open={modal === 'start_production'} title="Start production"
        confirmLabel="Production has started"
        onConfirm={() => run(() => supplierStartProduction(order.id), 'Production started — thank you!')}
        onClose={() => setModal(null)} pending={pending}
      >
        <p>Confirm production of order <b>#{order.order_number}</b> has begun.</p>
      </ConfirmModal>

      {/* Production complete */}
      <ConfirmModal
        open={modal === 'production_complete'} title="Mark production complete"
        confirmLabel="Production is complete"
        onConfirm={() => run(() => supplierMarkProductionComplete(order.id), 'Marked complete. Please upload QC photos next.')}
        onClose={() => setModal(null)} pending={pending}
      >
        <p>Order <b>#{order.order_number}</b> is fully made and ready for quality-control photos?</p>
        {order.supplier_price && <p>The remaining balance invoice will be raised automatically.</p>}
      </ConfirmModal>

      {/* Upload tracking */}
      {modal === 'upload_tracking' && (
        <div className="card p-4 space-y-2 bg-sand/40">
          <p className="text-sm font-medium">Upload tracking — #{order.order_number}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className="input text-sm" placeholder="Carrier" value={tracking.carrier}
              onChange={(e) => setTracking({ ...tracking, carrier: e.target.value })} />
            <input className="input text-sm" placeholder="Tracking number" value={tracking.number}
              onChange={(e) => setTracking({ ...tracking, number: e.target.value })} />
            <input className="input text-sm sm:col-span-2" placeholder="Tracking link (optional)" value={tracking.url}
              onChange={(e) => setTracking({ ...tracking, url: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-sm" disabled={!tracking.carrier || !tracking.number} onClick={() => setModal('tracking_confirm')}>Continue</button>
            <button className="btn-secondary text-sm" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={modal === 'tracking_confirm'} title="Confirm tracking"
        confirmLabel="Save tracking"
        onConfirm={() => run(() => supplierUploadTracking(order.id, {
          carrier: tracking.carrier, tracking_number: tracking.number,
          tracking_url: tracking.url || undefined,
          tracking_type: shipsToCustomer ? 'supplier_to_customer' : 'supplier_to_showroom',
        }), 'Tracking saved. Thank you!')}
        onClose={() => setModal(null)} pending={pending}
      >
        <p><b>{tracking.carrier}</b> — <b>{tracking.number}</b></p>
        <p>{shipsToCustomer ? 'This order ships direct to the customer.' : 'This order ships to the Milk & Honey showroom.'}</p>
      </ConfirmModal>

      {/* Upload invoice */}
      {modal === 'upload_invoice' && (
        <div className="card p-4 space-y-2 bg-sand/40">
          <p className="text-sm font-medium">Submit invoice — #{order.order_number}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select className="input text-sm" value={invoice.type}
              onChange={(e) => setInvoice({ ...invoice, type: e.target.value as typeof invoice.type })}>
              <option value="initial">{isReadyMade ? 'Full invoice' : 'Deposit invoice'}</option>
              <option value="balance">Final / balance invoice</option>
              <option value="other">Other</option>
            </select>
            <input className="input text-sm" placeholder="Your invoice number" value={invoice.number}
              onChange={(e) => setInvoice({ ...invoice, number: e.target.value })} />
            <input className="input text-sm" type="number" step="0.01" placeholder="Amount (USD)" value={invoice.amount}
              onChange={(e) => setInvoice({ ...invoice, amount: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <InvoiceFilePicker orderId={order.id} onPicked={(path, name) => setInvoice({ ...invoice, path, name })} />
            {invoice.name && <span className="text-muted truncate">📎 {invoice.name}</span>}
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={() => setModal('invoice_confirm')}>Continue</button>
            <button className="btn-secondary text-sm" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={modal === 'invoice_confirm'} title="Submit invoice for approval"
        confirmLabel="Submit invoice"
        onConfirm={() => run(() => uploadInvoice(order.id, {
          invoice_type: invoice.type, invoice_number: invoice.number || undefined,
          amount: invoice.amount ? Number(invoice.amount) : undefined,
          file_url: invoice.path || undefined,
        }), 'Invoice submitted for approval.')}
        onClose={() => setModal(null)} pending={pending}
      >
        <p>Invoice {invoice.number && <b>{invoice.number} </b>}{invoice.amount && <>for <b>${Number(invoice.amount).toFixed(2)} USD</b> </>}on order <b>#{order.order_number}</b>.</p>
        <p>Milk &amp; Honey will review it before payment.</p>
      </ConfirmModal>

      {/* QC photos */}
      {modal === 'upload_qc_photos' && (
        <div className="card p-4 space-y-2 bg-sand/40">
          <p className="text-sm font-medium">Upload quality-control photos — #{order.order_number}</p>
          <p className="text-xs text-muted">Clear photos of the finished wig: front, back, lace and hairline.</p>
          <FileUpload orderId={order.id} fileType="qc_photo" label="Choose photos…" multiple
            onUploaded={() => router.refresh()} />
          <button className="btn-secondary text-sm" onClick={() => setModal(null)}>Done</button>
        </div>
      )}

      {/* Add update / report problem */}
      {(modal === 'update' || modal === 'problem' || modal === 'add_update') && (
        <div className="card p-4 space-y-2 bg-sand/40">
          <p className="text-sm font-medium">{modal === 'problem' ? 'Report a problem' : 'Production update'} — #{order.order_number}</p>
          <textarea className="input text-sm" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)}
            placeholder={modal === 'problem' ? 'Describe the problem…' : 'How is this order going?'} />
          <div className="flex gap-2">
            <button className="btn-primary text-sm" disabled={pending || !msg.trim()}
              onClick={() => run(() => supplierAddUpdate(order.id, modal === 'problem' ? 'general_note' : 'production_update',
                modal === 'problem' ? `⚠ PROBLEM: ${msg.trim()}` : msg.trim()), 'Sent to Milk & Honey.')}>
              Send
            </button>
            <button className="btn-secondary text-sm" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Delay report (required when overdue) */}
      {modal === 'delay' && (
        <div className="card p-4 space-y-2 bg-red-50/60 border border-red-200">
          <p className="text-sm font-medium text-red-800">Report delay — #{order.order_number}</p>
          <input className="input text-sm" placeholder="Reason for delay (required)" value={delay.reason}
            onChange={(e) => setDelay({ ...delay, reason: e.target.value })} />
          <label className="label">Revised completion date</label>
          <input className="input text-sm w-44" type="date" value={delay.date}
            onChange={(e) => setDelay({ ...delay, date: e.target.value })} />
          <textarea className="input text-sm" rows={2} placeholder="Message (optional)" value={delay.message}
            onChange={(e) => setDelay({ ...delay, message: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn-primary text-sm" disabled={pending || !delay.reason.trim()}
              onClick={() => run(() => supplierReportDelay(order.id, {
                reason: delay.reason, revised_completion_date: delay.date || undefined, message: delay.message || undefined,
              }), 'Delay reported. Milk & Honey has been notified.')}>
              Submit delay report
            </button>
            <button className="btn-secondary text-sm" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Small helper: pick + upload the invoice PDF without registering a files row
// (the invoice row itself carries the path).
function InvoiceFilePicker({ orderId, onPicked }: { orderId: string; onPicked: (path: string, name: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="btn-secondary text-sm cursor-pointer">
      {busy ? 'Uploading…' : 'Attach invoice file…'}
      <input type="file" className="hidden" accept="image/*,application/pdf" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        const { path, error } = await uploadToOrder(orderId, file);
        setBusy(false);
        if (error || !path) { toast(`Upload failed: ${error}`, false); return; }
        onPicked(path, file.name);
      }} />
    </label>
  );
}
