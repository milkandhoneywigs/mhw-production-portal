import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { StageBadge, OrderTypeBadge, RiskBadge } from '@/components/Badges';
import { STAGE_STATUSES, STAGE_LABELS, type Stage } from '@/lib/constants';
import type { OrderWithRelations } from '@/lib/types';
import { unarchiveOrder } from '@/app/actions/orders';

export const dynamic = 'force-dynamic';

// Dashboard cards deep-link here with ?bucket=... These map to status filters.
const BUCKET_STATUSES: Record<string, string[]> = {
  new: ['new_ready_made_order', 'new_made_to_order'],
  rm_dispatch: ['new_ready_made_order', 'supplier_notified', 'awaiting_dhl_tracking'],
  mto_confirm: ['new_made_to_order', 'awaiting_supplier_confirmation'],
  production: ['in_production', 'production_update_due'],
  supplier_update: ['production_update_due'],
  ready_dispatch: ['ready_to_dispatch'],
};

export default async function OrdersPage({ searchParams }: { searchParams: { bucket?: string; q?: string; stage?: string; channel?: string; archived?: string } }) {
  const profile = await requireStaff();
  const isAdmin = profile.role === 'admin'; // supplier name is admin-only
  const supabase = createClient();

  // Archived orders (fulfilled / supplier-finished) are removed from every active
  // view; the Archived toggle surfaces them again so they can be reviewed/restored.
  const showArchived = searchParams.archived === '1';

  let query = supabase
    .from('orders')
    .select('*, customer:customers(*), supplier:suppliers(*)')
    .order('created_at', { ascending: false })
    .limit(200);
  query = showArchived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);

  const stage = searchParams.stage as Stage | undefined;
  const bucket = searchParams.bucket;
  const channel = searchParams.channel;
  if (channel === 'online') query = query.in('source', ['shopify', 'fresha']);
  else if (channel === 'instore') query = query.in('source', ['manual', 'custom', 'other']);
  if (stage && STAGE_STATUSES[stage]) query = query.in('status', STAGE_STATUSES[stage]);
  else if (bucket && BUCKET_STATUSES[bucket]) query = query.in('status', BUCKET_STATUSES[bucket]);
  else if (bucket === 'high_risk') query = query.eq('risk_level', 'high');
  else if (bucket === 'overdue') query = query.lt('expected_completion_date', new Date().toISOString());

  const { data } = await query;
  let orders = (data ?? []) as OrderWithRelations[];

  // Free-text search across order number, customer, style and supplier code.
  const q = (searchParams.q || '').trim().toLowerCase();
  if (q) {
    orders = orders.filter((o) =>
      [o.order_number, o.customer?.full_name, o.internal_style_name, o.supplier_style_code, o.customer_facing_product_name, o.supplier?.name]
        .some((v) => (v || '').toString().toLowerCase().includes(q)),
    );
  }

  return (
    <>
      <PageHeader
        title={showArchived ? 'Archived Orders' : 'Production Orders'}
        subtitle={showArchived ? `Fulfilled / finished orders removed from the active portal (${orders.length}) — restore any if needed`
          : q ? `Search "${q}" — ${orders.length} result(s)`
          : stage ? `${channel === 'online' ? 'Online · ' : channel === 'instore' ? 'In-store · ' : ''}${STAGE_LABELS[stage]} — ${orders.length}`
          : channel ? `${channel === 'online' ? 'Online' : 'In-store'} orders (${orders.length})`
          : bucket ? `Filtered: ${bucket.replace('_', ' ')}` : `All orders (${orders.length})`}
        action={
          <div className="flex items-center gap-2">
            <form method="get" className="flex items-center gap-2">
              {bucket && <input type="hidden" name="bucket" value={bucket} />}
              <input name="q" defaultValue={searchParams.q ?? ''} placeholder="Search order #, customer, style…" className="input w-64" />
              <button type="submit" className="btn-secondary">Search</button>
            </form>
            {showArchived
              ? <Link href="/orders" className="btn-secondary">← Active orders</Link>
              : <Link href="/orders?archived=1" className="btn-secondary">Archived</Link>}
            <Link href="/orders/restock" className="btn-secondary">Store Restock Order</Link>
            <Link href="/orders/new" className="btn-primary">Add Order</Link>
          </div>
        }
      />

      {orders.length === 0 ? (
        <EmptyState>No orders match this view.</EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr>
                <th className="th">Order</th>
                <th className="th">Type</th>
                <th className="th">Customer</th>
                <th className="th">Style</th>
                {isAdmin && <th className="th">Supplier</th>}
                <th className="th">Status</th>
                <th className="th">Flags</th>
                {showArchived && <th className="th"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-cream/60">
                  <td className="td font-medium">
                    <Link href={`/orders/${o.id}`} className="hover:underline">{o.order_number}</Link>
                    <div className="text-xs text-muted">{o.date_ordered}</div>
                  </td>
                  <td className="td"><OrderTypeBadge type={o.order_type} /></td>
                  <td className="td">{o.customer?.full_name ?? '-'}</td>
                  <td className="td">
                    {o.internal_style_name ?? '-'}
                    {o.supplier_style_code && <div className="text-xs text-muted">{o.supplier_style_code}</div>}
                  </td>
                  {isAdmin && <td className="td">{o.supplier?.name ?? <span className="text-muted">Unassigned</span>}</td>}
                  <td className="td"><StageBadge status={o.status} /></td>
                  <td className="td"><RiskBadge level={o.risk_level} /></td>
                  {showArchived && (
                    <td className="td">
                      <form action={async () => { 'use server'; await unarchiveOrder(o.id); }}>
                        <button type="submit" className="btn-secondary text-xs">Restore</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
