import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { stageOf, type OrderStatus } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Once an order has shipped (In Transit or Complete) its thread is archived and
// drops out of the main inbox, which stays focused on open/outstanding orders.
const SHIPPED_STAGES = new Set(['in_transit', 'complete']);

interface MsgRow {
  order_id: string;
  sender_role: string | null;
  sender_name: string | null;
  body: string;
  created_at: string;
  order: { order_number: string | null; status: OrderStatus; customer: { full_name: string | null } | null } | null;
}

// One row per order that has messages: order #, customer, last message + unread flag.
export default async function InboxPage({ searchParams }: { searchParams: { q?: string; archived?: string } }) {
  const profile = await requireStaff();
  const supabase = createClient();
  const showArchived = searchParams.archived === '1';

  const { data } = await supabase
    .from('order_messages')
    .select('order_id, sender_role, sender_name, body, created_at, order:orders(order_number, status, customer:customers(full_name))')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as unknown as MsgRow[];

  // Collapse to one entry per order (latest message first, so first seen = latest).
  const byOrder = new Map<string, { latest: MsgRow; count: number }>();
  for (const m of rows) {
    const cur = byOrder.get(m.order_id);
    if (cur) cur.count += 1;
    else byOrder.set(m.order_id, { latest: m, count: 1 });
  }

  // Unread = the latest message is from the OTHER party (supplier, for staff/admin).
  const otherRoles = ['supplier'];
  let threads = Array.from(byOrder.values()).map(({ latest, count }) => ({
    order_id: latest.order_id,
    order_number: latest.order?.order_number ?? '—',
    customer_name: latest.order?.customer?.full_name ?? '—',
    last_body: latest.body,
    last_sender: latest.sender_name || latest.sender_role || 'unknown',
    last_role: latest.sender_role,
    last_time: latest.created_at,
    count,
    unread: !!latest.sender_role && otherRoles.includes(latest.sender_role),
    archived: latest.order ? SHIPPED_STAGES.has(stageOf(latest.order.status)) : false,
  }));

  const archivedCount = threads.filter((t) => t.archived).length;
  const openCount = threads.length - archivedCount;
  // Main inbox = open/outstanding only; archived view = shipped/complete.
  threads = threads.filter((t) => t.archived === showArchived);

  // Search by order number or customer name.
  const q = (searchParams.q || '').trim().toLowerCase();
  if (q) threads = threads.filter((t) => `${t.order_number} ${t.customer_name}`.toLowerCase().includes(q));

  // Sort: unread first, then by order number, then customer name.
  threads.sort((a, b) =>
    Number(b.unread) - Number(a.unread) ||
    a.order_number.localeCompare(b.order_number, undefined, { numeric: true }) ||
    a.customer_name.localeCompare(b.customer_name),
  );

  const unreadCount = threads.filter((t) => t.unread).length;

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={showArchived
          ? `Archived (shipped) — ${threads.length} conversation(s)`
          : `Open orders — ${threads.length} conversation(s)${unreadCount ? ` · ${unreadCount} awaiting reply` : ''}`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/inbox" className={showArchived ? 'btn-secondary' : 'btn-primary'}>Open ({openCount})</Link>
            <Link href="/inbox?archived=1" className={showArchived ? 'btn-primary' : 'btn-secondary'}>Archived ({archivedCount})</Link>
            <form method="get" className="flex items-center gap-2">
              {showArchived && <input type="hidden" name="archived" value="1" />}
              <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search order # or customer…" className="input w-56" />
              <button type="submit" className="btn-secondary">Search</button>
            </form>
          </div>
        }
      />

      {threads.length === 0 ? (
        <EmptyState>No messages yet.</EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr>
                <th className="th w-8"></th>
                <th className="th">Order</th>
                <th className="th">Customer</th>
                <th className="th">Latest message</th>
                <th className="th">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {threads.map((t) => (
                <tr key={t.order_id} className={`hover:bg-cream/60 ${t.unread ? 'bg-honey/5' : ''}`}>
                  <td className="td">
                    {t.unread && <span className="inline-block w-2 h-2 rounded-full bg-honey" title="Awaiting reply" />}
                  </td>
                  <td className="td font-medium">
                    <Link href={`/orders/${t.order_id}`} className="hover:underline">{t.order_number}</Link>
                    {t.count > 1 && <span className="text-xs text-muted ml-1">({t.count})</span>}
                  </td>
                  <td className="td">{t.customer_name}</td>
                  <td className="td max-w-md">
                    <span className={`text-xs uppercase tracking-wide mr-1 ${t.unread ? 'text-honey font-semibold' : 'text-muted'}`}>{t.last_role ?? '—'}:</span>
                    <span className="text-sm">{t.last_body.length > 90 ? t.last_body.slice(0, 90) + '…' : t.last_body}</span>
                  </td>
                  <td className="td text-xs text-muted whitespace-nowrap">{new Date(t.last_time).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
