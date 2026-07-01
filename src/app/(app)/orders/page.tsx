import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { StatusBadge, OrderTypeBadge, RiskBadge } from '@/components/Badges';
import type { OrderWithRelations } from '@/lib/types';

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

export default async function OrdersPage({ searchParams }: { searchParams: { bucket?: string; q?: string } }) {
  await requireStaff();
  const supabase = createClient();

  let query = supabase
    .from('orders')
    .select('*, customer:customers(*), supplier:suppliers(*)')
    .order('created_at', { ascending: false })
    .limit(200);

  const bucket = searchParams.bucket;
  if (bucket && BUCKET_STATUSES[bucket]) query = query.in('status', BUCKET_STATUSES[bucket]);
  else if (bucket === 'high_risk') query = query.eq('risk_level', 'high');
  else if (bucket === 'overdue') query = query.lt('expected_completion_date', new Date().toISOString());

  const { data } = await query;
  const orders = (data ?? []) as OrderWithRelations[];

  return (
    <>
      <PageHeader
        title="Production Orders"
        subtitle={bucket ? `Filtered: ${bucket.replace('_', ' ')}` : 'All orders'}
        action={<Link href="/orders/new" className="btn-primary">Add Order</Link>}
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
                <th className="th">Supplier</th>
                <th className="th">Status</th>
                <th className="th">Flags</th>
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
                  <td className="td">{o.supplier?.name ?? <span className="text-muted">Unassigned</span>}</td>
                  <td className="td"><StatusBadge status={o.status} /></td>
                  <td className="td"><RiskBadge level={o.risk_level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
