'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Invoice } from '@/lib/types';

interface OrderRef { id: string; order_number: string; order_type: string }
interface PriceRequest extends OrderRef { style: string | null }

const TABS = [
  { key: 'price', label: 'Price Requests' },
  { key: 'deposit', label: 'Deposit Invoices' },
  { key: 'final', label: 'Final Invoices' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'rejected', label: 'Changes Required' },
] as const;

const STATUS_LABEL: Record<string, string> = {
  uploaded: 'Uploaded',
  submitted: 'Submitted for approval',
  approved: 'Approved',
  payment_required: 'Approved — payment due',
  scheduled_for_payment: 'Scheduled for payment',
  changes_requested: 'Changes requested',
  paid: 'Paid',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

const STATUS_CLASS: Record<string, string> = {
  submitted: 'bg-amber-50 text-amber-800 ring-amber-200',
  uploaded: 'bg-blue-50 text-blue-700 ring-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  payment_required: 'bg-orange-50 text-orange-800 ring-orange-200',
  scheduled_for_payment: 'bg-orange-50 text-orange-800 ring-orange-200',
  changes_requested: 'bg-red-50 text-red-700 ring-red-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  disputed: 'bg-red-50 text-red-700 ring-red-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
};

// Tabbed financial board: price requests + invoices by lifecycle.
export function PaymentsBoard({ invoices, orders, priceRequests, fileUrls }: {
  invoices: Invoice[]; orders: OrderRef[]; priceRequests: PriceRequest[];
  fileUrls: Record<string, string>;
}) {
  const [tab, setTab] = useState<string>(priceRequests.length > 0 ? 'price' : 'submitted');
  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const filtered = useMemo(() => {
    switch (tab) {
      case 'deposit': return invoices.filter((i) => i.invoice_type === 'initial');
      case 'final': return invoices.filter((i) => i.invoice_type === 'balance');
      case 'submitted': return invoices.filter((i) => ['submitted', 'uploaded'].includes(i.status));
      case 'approved': return invoices.filter((i) => ['approved', 'payment_required', 'scheduled_for_payment'].includes(i.status));
      case 'paid': return invoices.filter((i) => i.status === 'paid');
      case 'rejected': return invoices.filter((i) => ['changes_requested', 'disputed'].includes(i.status));
      default: return invoices;
    }
  }, [invoices, tab]);

  const count = (key: string) => {
    switch (key) {
      case 'price': return priceRequests.length;
      case 'deposit': return invoices.filter((i) => i.invoice_type === 'initial').length;
      case 'final': return invoices.filter((i) => i.invoice_type === 'balance').length;
      case 'submitted': return invoices.filter((i) => ['submitted', 'uploaded'].includes(i.status)).length;
      case 'approved': return invoices.filter((i) => ['approved', 'payment_required', 'scheduled_for_payment'].includes(i.status)).length;
      case 'paid': return invoices.filter((i) => i.status === 'paid').length;
      case 'rejected': return invoices.filter((i) => ['changes_requested', 'disputed'].includes(i.status)).length;
      default: return 0;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${tab === t.key ? 'bg-ink text-cream ring-ink' : 'bg-cream text-ink ring-beige hover:bg-sand'}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({count(t.key)})
          </button>
        ))}
      </div>

      {tab === 'price' ? (
        priceRequests.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">No orders are waiting on a price from you.</div>
        ) : (
          <div className="space-y-2">
            {priceRequests.map((o) => (
              <div key={o.id} className="card p-3 md:px-4 flex flex-col md:flex-row md:items-center gap-2">
                <span className="font-medium md:w-32">#{o.order_number}</span>
                <span className="text-sm text-muted flex-1">{o.style ?? '—'}</span>
                <Link href={`/supplier/orders/${o.id}`} className="btn-primary text-xs md:w-32 text-center">Add price</Link>
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">Nothing here.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => {
            const order = orderById.get(i.order_id);
            const url = i.file_url ? fileUrls[i.file_url] ?? (i.file_url.startsWith('http') ? i.file_url : null) : null;
            return (
              <div key={i.id} className="card p-3 md:px-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="md:w-36 shrink-0">
                  <div className="font-medium">{i.invoice_number ?? (i.invoice_type === 'initial' ? 'Deposit' : i.invoice_type === 'balance' ? 'Balance' : 'Invoice')}</div>
                  <div className="text-xs text-muted">{new Date(i.created_at).toLocaleDateString('en-AU')}</div>
                </div>
                <div className="md:w-32 shrink-0 text-sm">
                  {order ? (
                    <Link href={`/supplier/orders/${order.id}`} className="underline underline-offset-2">#{order.order_number}</Link>
                  ) : '—'}
                  <div className="text-[10px] text-muted uppercase">{order?.order_type.replaceAll('_', ' ')}</div>
                </div>
                <div className="md:w-28 shrink-0 text-sm font-medium tabular-nums">
                  {i.amount != null ? `$${Number(i.amount).toFixed(2)}` : '—'} <span className="text-xs text-muted">{i.currency}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_CLASS[i.status] ?? 'bg-sand text-ink ring-beige'}`}>
                    {STATUS_LABEL[i.status] ?? i.status}
                  </span>
                  {i.notes && <p className="text-xs text-red-700 mt-1">Milk &amp; Honey: {i.notes}</p>}
                  {i.paid_at && <p className="text-xs text-muted mt-1">Paid {new Date(i.paid_at).toLocaleDateString('en-AU')}{i.payment_reference ? ` · ref ${i.payment_reference}` : ''}</p>}
                </div>
                <div className="md:w-24 shrink-0 md:text-right">
                  {url && <a className="btn-secondary text-xs" href={url} target="_blank" rel="noreferrer">View</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
