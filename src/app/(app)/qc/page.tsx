import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { StatusBadge, Flag } from '@/components/Badges';
import { QcForm } from '@/components/qc/QcForm';
import type { OrderWithRelations } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function QcQueuePage() {
  await requireStaff();
  const supabase = createClient();
  const { data } = await supabase
    .from('orders')
    .select('*, customer:customers(full_name)')
    .in('status', ['arrived_at_showroom', 'qc_required'])
    .order('arrived_at_showroom_at', { ascending: true });
  const orders = (data ?? []) as OrderWithRelations[];

  return (
    <>
      <PageHeader title="QC Queue" subtitle="Orders arrived at the showroom and awaiting quality check." />
      {orders.length === 0 ? <EmptyState>Nothing awaiting QC. 🎉</EmptyState> : (
        <div className="grid md:grid-cols-2 gap-4">
          {orders.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <Link href={`/orders/${o.id}`} className="font-medium hover:underline">{o.order_number}</Link>
                <div className="flex gap-2"><Flag tone="qc">QC REQUIRED</Flag><StatusBadge status={o.status} /></div>
              </div>
              <dl className="text-sm grid grid-cols-2 gap-x-3">
                <div><span className="text-muted">Customer:</span> {o.customer?.full_name ?? '-'}</div>
                <div><span className="text-muted">Style:</span> {o.internal_style_name ?? '-'}</div>
                <div><span className="text-muted">Length:</span> {o.customer_ordered_length ?? '-'}</div>
                <div><span className="text-muted">Cap:</span> {o.cap_size ?? '-'}</div>
                <div><span className="text-muted">Density:</span> {o.density ?? '-'}</div>
                <div><span className="text-muted">Colour:</span> {o.colour_notes ?? '-'}</div>
              </dl>
              <QcForm orderId={o.id} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
