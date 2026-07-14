import Link from 'next/link';
import { requireSupplier } from '@/lib/auth';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { SummaryCards } from '@/components/supplier/Summary';
import { OrderTypeBadge } from '@/components/Badges';
import { fetchSupplierOrders, fetchUnreadOrderIds, buildTasks } from '@/lib/supplier-data';
import { daysUntil } from '@/lib/supplier-portal';

export const dynamic = 'force-dynamic';

// Supplier home: what needs doing, at a glance.
export default async function SupplierDashboard() {
  const profile = await requireSupplier();
  const orders = await fetchSupplierOrders();
  const unread = await fetchUnreadOrderIds(profile.id, true);
  const tasks = buildTasks(orders, unread);

  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const dueSoon = active.filter((o) => {
    const d = daysUntil(o.expected_completion_date);
    return d !== null && d >= 0 && d <= 7;
  });
  const overdue = active.filter((o) => {
    const d = daysUntil(o.expected_completion_date);
    return d !== null && d < 0 && !['tracking_uploaded', 'customer_notified'].includes(o.status);
  });

  const summary = [
    { label: 'New orders to confirm', value: orders.filter((o) => ['new_ready_made_order', 'new_made_to_order'].includes(o.status)).length, tone: 'new' as const },
    { label: 'In production', value: orders.filter((o) => ['in_production', 'production_update_due'].includes(o.status)).length, tone: 'production' as const },
    { label: 'Due within 7 days', value: dueSoon.length, tone: 'payment' as const },
    { label: 'Overdue', value: overdue.length, tone: 'risk' as const },
    { label: 'Tracking required', value: orders.filter((o) => ['awaiting_dhl_tracking', 'balance_paid', 'ready_to_dispatch'].includes(o.status)).length, tone: 'ready' as const },
    { label: 'Unread messages', value: unread.size, tone: 'qc' as const },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile.full_name || 'Supplier'}`}
        subtitle="Your orders and tasks. Everything here relates only to orders assigned to you."
      />
      <SummaryCards items={summary} />

      <Section title={`Tasks requiring action (${tasks.length})`}>
        {tasks.length === 0 ? (
          <EmptyState>Nothing needs your action right now. 🎉</EmptyState>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={`${t.orderId}-${t.label}`} className="card p-3 md:px-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="md:w-36 shrink-0 flex items-center gap-2">
                  <span className="font-medium">#{t.orderNumber}</span>
                  {t.urgent && (
                    <span className="rounded-full px-2 py-0.5 bg-red-50 text-red-700 ring-1 ring-red-200 text-[10px] font-semibold">URGENT</span>
                  )}
                </div>
                <div className="md:w-36 shrink-0"><OrderTypeBadge type={t.orderType} /></div>
                <div className="flex-1 min-w-0 text-sm text-muted truncate">{t.detail || '—'}</div>
                <Link href={t.href} className="btn-primary text-xs md:w-48 text-center">{t.label}</Link>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
