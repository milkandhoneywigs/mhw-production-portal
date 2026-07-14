import { requireSupplier } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { SummaryCards } from '@/components/supplier/Summary';
import { OrderTable } from '@/components/supplier/OrderTable';
import { READY_TO_SHIP_TABS } from '@/lib/supplier-portal';
import { fetchSupplierOrders } from '@/lib/supplier-data';
import { SUPPLIER_INSTRUCTION_SHIPPING } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Existing ready-made stock the supplier ships DIRECT to the customer.
export default async function ReadyToShipPage() {
  await requireSupplier();
  const orders = await fetchSupplierOrders('ready_made');

  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
  const summary = [
    { label: 'New orders', value: orders.filter((o) => o.status === 'new_ready_made_order').length, tone: 'new' as const },
    { label: 'Awaiting confirmation', value: orders.filter((o) => o.status === 'new_ready_made_order').length, tone: 'payment' as const },
    { label: 'Ready to dispatch', value: orders.filter((o) => ['supplier_notified', 'awaiting_dhl_tracking'].includes(o.status)).length, tone: 'ready' as const },
    { label: 'Tracking required', value: orders.filter((o) => o.status === 'awaiting_dhl_tracking').length, tone: 'risk' as const },
    { label: 'Completed this month', value: orders.filter((o) => ['completed', 'tracking_uploaded', 'customer_notified'].includes(o.status) && new Date(o.updated_at) >= thisMonth).length, tone: 'done' as const },
  ];

  return (
    <>
      <PageHeader
        title="Ready to Ship Orders"
        subtitle={SUPPLIER_INSTRUCTION_SHIPPING.ready_made}
      />
      <SummaryCards items={summary} />
      <OrderTable orders={orders} tabs={READY_TO_SHIP_TABS} />
    </>
  );
}
