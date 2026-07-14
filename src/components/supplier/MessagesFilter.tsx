'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { OrderTypeBadge } from '@/components/Badges';
import type { OrderType } from '@/lib/constants';

export interface ThreadRow {
  orderId: string;
  orderNumber: string;
  orderType: OrderType;
  style: string | null;
  latestBody: string;
  latestSender: string | null;
  latestAt: string;
  unread: boolean;
  hasAttachment: boolean;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'ready_made', label: 'Ready to Ship' },
  { key: 'made_to_order', label: 'Made to Order' },
  { key: 'stock', label: 'Bulk Orders' },
] as const;

export function MessagesFilter({ threads }: { threads: ThreadRow[] }) {
  const [filter, setFilter] = useState<string>('all');

  const rows = useMemo(() => {
    if (filter === 'unread') return threads.filter((t) => t.unread);
    if (filter === 'all') return threads;
    return threads.filter((t) => t.orderType === filter);
  }, [threads, filter]);

  const count = (key: string) =>
    key === 'all' ? threads.length
    : key === 'unread' ? threads.filter((t) => t.unread).length
    : threads.filter((t) => t.orderType === key).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${filter === f.key ? 'bg-ink text-cream ring-ink' : 'bg-cream text-ink ring-beige hover:bg-sand'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>

      {rows.length === 0 && <div className="card p-8 text-center text-sm text-muted">No conversations here.</div>}

      <div className="space-y-2">
        {rows.map((t) => (
          <Link
            key={t.orderId}
            href={`/supplier/orders/${t.orderId}#messages`}
            className={`card p-3 md:px-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 hover:bg-sand/50 transition ${t.unread ? 'ring-1 ring-honey' : ''}`}
          >
            <div className="md:w-32 shrink-0 flex items-center gap-2">
              {t.unread && <span className="w-2 h-2 rounded-full bg-honey" aria-label="Unread" />}
              <span className="font-medium">#{t.orderNumber}</span>
            </div>
            <div className="md:w-36 shrink-0"><OrderTypeBadge type={t.orderType} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">
                {t.hasAttachment && <span aria-hidden>📎 </span>}
                <span className={t.unread ? 'font-medium' : ''}>{t.latestBody || '(attachment)'}</span>
              </div>
              <div className="text-xs text-muted truncate">
                {t.latestSender ?? 'Unknown'} · {t.style ?? ''}
              </div>
            </div>
            <div className="md:w-36 shrink-0 text-xs text-muted md:text-right">
              {new Date(t.latestAt).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
