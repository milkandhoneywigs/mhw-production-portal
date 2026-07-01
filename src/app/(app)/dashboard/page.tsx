import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, StatCard, Section } from '@/components/ui';
import { computeDashboard } from '@/lib/dashboard';
import { STAGES, STAGE_LABELS, STAGE_NOTE, stageOf } from '@/lib/constants';
import type { Order, Invoice } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireStaff();
  const supabase = createClient();

  const [{ data: allOrders }, { data: invoices }] = await Promise.all([
    supabase.from('orders').select('*').order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').in('status', ['uploaded', 'payment_required', 'disputed']),
  ]);
  const orders = (allOrders ?? []) as Order[];
  const active = orders.filter((o) => o.status !== 'completed');
  const c = computeDashboard(active, (invoices ?? []) as Invoice[]);
  const isOnline = (o: Order) => o.source === 'shopify' || o.source === 'fresha';
  const stageCount = (st: (typeof STAGES)[number], ch?: 'online' | 'instore') =>
    orders.filter((o) => stageOf(o.status) === st && (ch === undefined || (ch === 'online') === isOnline(o))).length;

  const StageRow = ({ channel }: { channel: 'online' | 'instore' }) => (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {STAGES.map((st) => (
        <Link key={st} href={`/orders?stage=${st}&channel=${channel}`} className="card p-4 hover:shadow-md transition">
          <div className="text-2xl font-semibold tabular-nums">{stageCount(st, channel)}</div>
          <div className="text-sm font-semibold mt-1">{STAGE_LABELS[st]}</div>
          <div className="text-xs text-muted mt-0.5 leading-snug">{STAGE_NOTE[st]}</div>
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader title="Production Dashboard" subtitle="Order stages at a glance." />

      {/* 5-stage lifecycle, split by channel. Click a stage to see those orders. */}
      <Section title="Online orders (Shopify)">
        <StageRow channel="online" />
      </Section>
      <Section title="In-store orders">
        <StageRow channel="instore" />
      </Section>

      <Section title="Payments">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Invoices requiring payment" value={c.invoicesRequiringPayment} href="/billing" tone={c.invoicesRequiringPayment ? 'warn' : 'neutral'} />
          <StatCard label="Balance payments requiring payment" value={c.balancePaymentsRequired} href="/billing?bucket=balance" tone={c.balancePaymentsRequired ? 'danger' : 'neutral'} />
        </div>
      </Section>

      <Section title="Production">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Orders in production" value={c.inProduction} href="/orders?bucket=production" />
          <StatCard label="Production overdue" value={c.productionOverdue} href="/orders?bucket=overdue" tone={c.productionOverdue ? 'danger' : 'neutral'} />
          <StatCard label="Supplier updates due" value={c.supplierUpdatesDue} href="/orders?bucket=supplier_update" tone={c.supplierUpdatesDue ? 'warn' : 'neutral'} />
          <StatCard label="Customer updates due" value={c.customerUpdatesDue} href="/customer-updates" tone={c.customerUpdatesDue ? 'warn' : 'neutral'} />
        </div>
      </Section>

      <Section title="Showroom &amp; dispatch">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Arrived at showroom / QC required" value={c.arrivedQc} href="/qc" tone={c.arrivedQc ? 'warn' : 'neutral'} />
          <StatCard label="Ready to dispatch" value={c.readyToDispatch} href="/orders?bucket=ready_dispatch" tone={c.readyToDispatch ? 'good' : 'neutral'} />
        </div>
      </Section>
    </>
  );
}
