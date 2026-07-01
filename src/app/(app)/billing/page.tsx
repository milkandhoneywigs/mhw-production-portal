import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, StatCard, EmptyState } from '@/components/ui';
import { Flag } from '@/components/Badges';
import { MarkPaidForm } from '@/components/billing/MarkPaidForm';
import { INVOICE_MEDIUM_RISK_HOURS, INVOICE_HIGH_RISK_HOURS } from '@/lib/constants';
import type { Invoice } from '@/lib/types';

export const dynamic = 'force-dynamic';

type InvoiceRow = Invoice & { order?: { order_number: string; status: string } | null; supplier?: { name: string } | null };

function ageHours(iso: string) { return (Date.now() - new Date(iso).getTime()) / 3600000; }

export default async function BillingPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from('invoices')
    .select('*, order:orders(order_number, status), supplier:suppliers(name)')
    .order('created_at', { ascending: false });
  const invoices = (data ?? []) as InvoiceRow[];

  const unpaid = invoices.filter((i) => i.status === 'uploaded' || i.status === 'payment_required');
  const balanceReq = unpaid.filter((i) => i.invoice_type === 'balance');
  const initialReq = unpaid.filter((i) => i.invoice_type !== 'balance');
  const paid = invoices.filter((i) => i.status === 'paid');

  // Supplier spend this month (sum of paid invoices paid this calendar month).
  const now = new Date();
  const spend = new Map<string, number>();
  for (const i of paid) {
    if (!i.paid_at || !i.amount) continue;
    const d = new Date(i.paid_at);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      const key = i.supplier?.name ?? 'Unknown';
      spend.set(key, (spend.get(key) ?? 0) + Number(i.amount));
    }
  }

  const riskChip = (i: InvoiceRow) => {
    const h = ageHours(i.created_at);
    if (h >= INVOICE_HIGH_RISK_HOURS) return <Flag tone="blocked">HIGH RISK &gt;48h</Flag>;
    if (h >= INVOICE_MEDIUM_RISK_HOURS) return <Flag tone="risk">AT RISK &gt;24h</Flag>;
    return null;
  };

  const table = (rows: InvoiceRow[], showBlocked = false) => (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead className="bg-sand/60 border-b border-beige"><tr>
          <th className="th">Order</th><th className="th">Supplier</th><th className="th">Type</th>
          <th className="th">Invoice</th><th className="th">Amount</th><th className="th">Flags</th><th className="th">Action</th>
        </tr></thead>
        <tbody className="divide-y divide-beige">
          {rows.map((i) => {
            const blocked = showBlocked && i.invoice_type === 'balance' && i.order?.status === 'balance_payment_required';
            return (
              <tr key={i.id}>
                <td className="td font-medium"><Link href={`/orders/${i.order_id}`} className="hover:underline">{i.order?.order_number ?? '-'}</Link></td>
                <td className="td">{i.supplier?.name ?? '-'}</td>
                <td className="td"><Flag tone={i.invoice_type === 'balance' ? 'balance' : 'payment'}>{i.invoice_type === 'balance' ? 'BALANCE REQUIRED' : 'PAYMENT REQUIRED'}</Flag></td>
                <td className="td">{i.invoice_number ?? '-'}</td>
                <td className="td">{i.amount ? `${i.currency} ${i.amount}` : '-'}</td>
                <td className="td space-x-1">{riskChip(i)}{blocked && <Flag tone="blocked">SHIPMENT BLOCKED</Flag>}</td>
                <td className="td"><MarkPaidForm invoiceId={i.id} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader title="Billing" subtitle="Invoice status only. Payments are made manually outside the portal." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Invoices requiring payment" value={initialReq.length} tone={initialReq.length ? 'warn' : 'neutral'} />
        <StatCard label="Balance payments required" value={balanceReq.length} tone={balanceReq.length ? 'danger' : 'neutral'} />
        <StatCard label="Paid invoices" value={paid.length} tone="good" />
        <StatCard label="Suppliers billed this month" value={spend.size} />
      </div>

      <Section title="Balance required (shipment blocked)">
        {balanceReq.length ? table(balanceReq, true) : <EmptyState>No balance payments outstanding.</EmptyState>}
      </Section>

      <Section title="Invoices requiring payment">
        {initialReq.length ? table(initialReq) : <EmptyState>No unpaid invoices.</EmptyState>}
      </Section>

      <Section title="Supplier spend this month">
        {spend.size === 0 ? <EmptyState>No payments recorded this month.</EmptyState> : (
          <div className="card p-4">
            <ul className="text-sm divide-y divide-beige">
              {[...spend.entries()].map(([name, amt]) => (
                <li key={name} className="flex justify-between py-1.5"><span>{name}</span><span className="font-medium tabular-nums">AUD {amt.toFixed(2)}</span></li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Recently paid">
        {paid.length ? (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-sand/60 border-b border-beige"><tr>
                <th className="th">Order</th><th className="th">Supplier</th><th className="th">Amount</th><th className="th">Method</th><th className="th">Reference</th><th className="th">Paid</th>
              </tr></thead>
              <tbody className="divide-y divide-beige">
                {paid.slice(0, 25).map((i) => (
                  <tr key={i.id}>
                    <td className="td"><Link href={`/orders/${i.order_id}`} className="hover:underline">{i.order?.order_number ?? '-'}</Link></td>
                    <td className="td">{i.supplier?.name ?? '-'}</td>
                    <td className="td">{i.amount ? `${i.currency} ${i.amount}` : '-'}</td>
                    <td className="td capitalize">{i.payment_method?.replace('_', ' ') ?? '-'}</td>
                    <td className="td">{i.payment_reference ?? '-'}</td>
                    <td className="td">{i.paid_at ? new Date(i.paid_at).toLocaleDateString('en-AU') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>No paid invoices yet.</EmptyState>}
      </Section>
    </>
  );
}
