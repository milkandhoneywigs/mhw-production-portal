'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/Badges';
import type { SupplierOrderRow } from '@/lib/supplier-data';
import type { StatusTab } from '@/lib/supplier-portal';
import { daysUntil, primaryActionFor } from '@/lib/supplier-portal';
import type { OrderStatus } from '@/lib/constants';

const PAGE_SIZE = 15;

// Compact, searchable order list: status tabs -> filtered rows -> detail page.
// Desktop = table rows; mobile = stacked cards.
export function OrderTable({ orders, tabs, showDue = false }: {
  orders: SupplierOrderRow[]; tabs: StatusTab[]; showDue?: boolean;
}) {
  const [tab, setTab] = useState<string>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const activeTab = tabs.find((t) => t.key === tab);
    let rows = activeTab ? orders.filter((o) => (activeTab.statuses as OrderStatus[]).includes(o.status)) : orders;
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((o) =>
        [o.order_number, o.supplier_reference, o.internal_style_name, o.supplier_style_code, o.colour_notes]
          .some((v) => v?.toLowerCase().includes(needle)),
      );
    }
    return rows;
  }, [orders, tabs, tab, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${tab === 'all' ? 'bg-ink text-cream ring-ink' : 'bg-cream text-ink ring-beige hover:bg-sand'}`}
          onClick={() => { setTab('all'); setPage(0); }}
        >
          All ({orders.length})
        </button>
        {tabs.map((t) => {
          const n = orders.filter((o) => (t.statuses as OrderStatus[]).includes(o.status)).length;
          return (
            <button
              key={t.key}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${tab === t.key ? 'bg-ink text-cream ring-ink' : 'bg-cream text-ink ring-beige hover:bg-sand'}`}
              onClick={() => { setTab(t.key); setPage(0); }}
            >
              {t.label} ({n})
            </button>
          );
        })}
        <input
          className="input text-sm ml-auto w-full sm:w-64"
          placeholder="Search order, reference, style, code, colour…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
        />
      </div>

      {rows.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted">No orders here.</div>
      )}

      <div className="space-y-2">
        {rows.map((o) => {
          const days = daysUntil(o.expected_completion_date);
          const overdue = showDue && days !== null && days < 0 && !['completed', 'cancelled', 'tracking_uploaded', 'customer_notified'].includes(o.status);
          const action = primaryActionFor(o.order_type, o.status);
          return (
            <Link
              key={o.id}
              href={`/supplier/orders/${o.id}`}
              className="card p-3 md:px-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 hover:bg-sand/50 transition"
            >
              <div className="md:w-40 shrink-0">
                <div className="font-medium">#{o.order_number}</div>
                <div className="text-xs text-muted">{new Date(o.date_ordered).toLocaleDateString('en-AU')}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">
                  <span className="font-medium">{o.internal_style_name ?? o.customer_facing_product_name ?? '—'}</span>
                  {o.supplier_style_code && <span className="text-muted"> · {o.supplier_style_code}</span>}
                  {o.quantity > 1 && <span className="text-muted"> · ×{o.quantity}</span>}
                </div>
                <div className="text-xs text-muted truncate">
                  {[o.supplier_order_length, o.cap_size, o.density, o.colour_notes].filter(Boolean).join(' · ')}
                </div>
              </div>
              {showDue && (
                <div className="md:w-32 shrink-0 text-xs">
                  {o.expected_completion_date ? (
                    overdue ? (
                      <span className="inline-flex rounded-full px-2 py-0.5 bg-red-50 text-red-700 ring-1 ring-red-200 font-semibold">
                        {Math.abs(days!)}d OVERDUE
                      </span>
                    ) : (
                      <span className="text-muted">Due {new Date(o.expected_completion_date).toLocaleDateString('en-AU')}{days !== null && days >= 0 ? ` (${days}d)` : ''}</span>
                    )
                  ) : <span className="text-muted">—</span>}
                </div>
              )}
              <div className="md:w-44 shrink-0 flex md:justify-end"><StatusBadge status={o.status} /></div>
              <div className="md:w-40 shrink-0 md:text-right">
                {action && <span className="btn-primary text-xs inline-block pointer-events-none">{action.label}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn-secondary text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
          <span className="text-muted">Page {page + 1} of {pages}</span>
          <button className="btn-secondary text-xs" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
