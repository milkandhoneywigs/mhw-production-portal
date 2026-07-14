import { requireSupplier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { SummaryCards } from '@/components/supplier/Summary';
import { PaymentsBoard } from '@/components/supplier/PaymentsBoard';
import { fetchSupplierOrders } from '@/lib/supplier-data';
import { signFileUrls } from '@/lib/storage';
import type { Invoice } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Dedicated financial area: price requests + invoices, out of the order cards.
export default async function PaymentsPage() {
  await requireSupplier();
  const supabase = createClient();
  const [orders, { data: invs }] = await Promise.all([
    fetchSupplierOrders(),
    supabase.from('invoices').select('*').order('created_at', { ascending: false }),
  ]);
  const invoices = ((invs ?? []) as Invoice[]).filter((i) => orders.some((o) => o.id === i.order_id));
  const urls = await signFileUrls(
    invoices.flatMap((i) => [i.file_url, i.receipt_url]).filter(Boolean) as string[],
  );

  // Orders where the supplier still owes a price.
  const priceRequests = orders.filter((o) =>
    o.supplier_price == null &&
    !['completed', 'cancelled', 'new_ready_made_order', 'new_made_to_order'].includes(o.status));

  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
  const outstanding = invoices
    .filter((i) => ['submitted', 'payment_required', 'approved', 'scheduled_for_payment', 'uploaded'].includes(i.status))
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);

  const summary = [
    { label: 'Awaiting price', value: priceRequests.length, tone: 'new' as const },
    { label: 'Awaiting M&H approval', value: invoices.filter((i) => i.status === 'submitted').length, tone: 'payment' as const },
    { label: 'Deposit invoices due', value: invoices.filter((i) => i.invoice_type === 'initial' && ['payment_required', 'approved', 'scheduled_for_payment'].includes(i.status)).length, tone: 'payment' as const },
    { label: 'Balance invoices due', value: invoices.filter((i) => i.invoice_type === 'balance' && ['payment_required', 'approved', 'scheduled_for_payment'].includes(i.status)).length, tone: 'balance' as const },
    { label: 'Changes requested', value: invoices.filter((i) => i.status === 'changes_requested').length, tone: 'risk' as const },
    { label: 'Paid this month', value: invoices.filter((i) => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= thisMonth).length, tone: 'ready' as const },
    { label: 'Outstanding (USD)', value: `$${outstanding.toFixed(0)}`, tone: 'neutral' as const },
  ];

  return (
    <>
      <PageHeader
        title="Payments / Invoicing"
        subtitle="Prices you need to add, invoices awaiting approval or payment, and everything already paid."
      />
      <SummaryCards items={summary} />
      <PaymentsBoard
        invoices={invoices}
        orders={orders.map((o) => ({ id: o.id, order_number: o.order_number, order_type: o.order_type }))}
        priceRequests={priceRequests.map((o) => ({ id: o.id, order_number: o.order_number, order_type: o.order_type, style: o.internal_style_name }))}
        fileUrls={urls}
      />
    </>
  );
}
