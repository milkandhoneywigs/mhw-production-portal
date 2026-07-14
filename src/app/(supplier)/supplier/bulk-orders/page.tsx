import Link from 'next/link';
import { requireSupplier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { SummaryCards, ProgressBar } from '@/components/supplier/Summary';
import { StatusBadge } from '@/components/Badges';
import { BulkLineItems } from '@/components/supplier/BulkLineItems';
import { fetchSupplierOrders } from '@/lib/supplier-data';
import type { RestockItemRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Wholesale / showroom stock orders — parent order + expandable line items.
export default async function BulkOrdersPage() {
  await requireSupplier();
  const orders = await fetchSupplierOrders('stock');
  const supabase = createClient();
  const { data: items } = orders.length
    ? await supabase.from('restock_items').select('*').in('order_id', orders.map((o) => o.id)).order('position')
    : { data: [] as RestockItemRow[] };
  const byOrder = new Map<string, RestockItemRow[]>();
  for (const it of (items ?? []) as RestockItemRow[]) {
    const list = byOrder.get(it.order_id) ?? [];
    list.push(it); byOrder.set(it.order_id, list);
  }

  const totals = (id: string) => {
    const list = byOrder.get(id) ?? [];
    const total = list.reduce((s, i) => s + i.quantity, 0);
    const done = list.reduce((s, i) => s + i.qty_completed, 0);
    return { total, done };
  };

  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const outstanding = active.reduce((s, o) => { const t = totals(o.id); return s + (t.total - t.done); }, 0);
  const summary = [
    { label: 'New bulk orders', value: orders.filter((o) => ['new_made_to_order', 'awaiting_supplier_confirmation'].includes(o.status)).length, tone: 'new' as const },
    { label: 'In production', value: orders.filter((o) => ['in_production', 'production_update_due'].includes(o.status)).length, tone: 'production' as const },
    { label: 'Partially completed', value: active.filter((o) => { const t = totals(o.id); return t.done > 0 && t.done < t.total; }).length, tone: 'payment' as const },
    { label: 'Ready to ship', value: orders.filter((o) => ['balance_paid', 'ready_to_dispatch', 'production_complete'].includes(o.status)).length, tone: 'ready' as const },
    { label: 'Outstanding units', value: outstanding, tone: 'risk' as const },
  ];

  return (
    <>
      <PageHeader
        title="Bulk Store Orders"
        subtitle="Showroom stock orders with multiple styles. Update quantities as you complete them — partial shipments are fine."
      />
      <SummaryCards items={summary} />
      {orders.length === 0 && <EmptyState>No bulk orders assigned to you yet.</EmptyState>}
      <div className="space-y-4">
        {orders.map((o) => {
          const t = totals(o.id);
          return (
            <div key={o.id} className="card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/supplier/orders/${o.id}`} className="font-medium underline-offset-2 hover:underline">
                  #{o.order_number}
                </Link>
                <span className="text-xs text-muted">{new Date(o.date_ordered).toLocaleDateString('en-AU')}</span>
                {o.expected_completion_date && <span className="text-xs text-muted">Due {new Date(o.expected_completion_date).toLocaleDateString('en-AU')}</span>}
                {o.supplier_price != null && <span className="text-xs text-muted">Value ${Number(o.supplier_price).toFixed(2)}</span>}
                <span className="ml-auto"><StatusBadge status={o.status} /></span>
              </div>
              <ProgressBar done={t.done} total={t.total} />
              <BulkLineItems items={byOrder.get(o.id) ?? []} />
            </div>
          );
        })}
      </div>
    </>
  );
}
