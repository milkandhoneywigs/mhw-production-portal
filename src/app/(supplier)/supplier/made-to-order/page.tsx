import { requireSupplier } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { SummaryCards } from '@/components/supplier/Summary';
import { OrderTable } from '@/components/supplier/OrderTable';
import { MADE_TO_ORDER_TABS, daysUntil } from '@/lib/supplier-portal';
import { fetchSupplierOrders } from '@/lib/supplier-data';
import { SUPPLIER_INSTRUCTION_SHIPPING } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Custom / made-to-order wigs: produce, QC, then ship to the M&H showroom.
export default async function MadeToOrderPage() {
  await requireSupplier();
  const orders = await fetchSupplierOrders('made_to_order');

  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
  const summary = [
    { label: 'New orders', value: orders.filter((o) => o.status === 'new_made_to_order').length, tone: 'new' as const },
    { label: 'Awaiting confirmation', value: orders.filter((o) => o.status === 'awaiting_supplier_confirmation').length, tone: 'payment' as const },
    { label: 'In production', value: orders.filter((o) => ['in_production', 'production_update_due'].includes(o.status)).length, tone: 'production' as const },
    { label: 'Due within 7 days', value: active.filter((o) => { const d = daysUntil(o.expected_completion_date); return d !== null && d >= 0 && d <= 7; }).length, tone: 'payment' as const },
    { label: 'Overdue', value: active.filter((o) => { const d = daysUntil(o.expected_completion_date); return d !== null && d < 0; }).length, tone: 'risk' as const },
    { label: 'Ready to ship', value: orders.filter((o) => ['balance_paid', 'ready_to_dispatch', 'qc_passed'].includes(o.status)).length, tone: 'ready' as const },
    { label: 'Completed this month', value: orders.filter((o) => o.status === 'completed' && new Date(o.updated_at) >= thisMonth).length, tone: 'done' as const },
  ];

  return (
    <>
      <PageHeader
        title="Made to Order"
        subtitle={SUPPLIER_INSTRUCTION_SHIPPING.made_to_order}
      />
      <SummaryCards items={summary} />
      <OrderTable orders={orders} tabs={MADE_TO_ORDER_TABS} showDue />
    </>
  );
}
