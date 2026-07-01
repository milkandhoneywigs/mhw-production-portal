import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, StatCard, Section } from '@/components/ui';
import { computeDashboard } from '@/lib/dashboard';
import type { Order, Invoice } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireStaff();
  const supabase = createClient();

  // Pull active (non-completed) orders + all non-final invoices for bucketing.
  const [{ data: orders }, { data: invoices }] = await Promise.all([
    supabase.from('orders').select('*').neq('status', 'completed').order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').in('status', ['uploaded', 'payment_required', 'disputed']),
  ]);

  const c = computeDashboard((orders ?? []) as Order[], (invoices ?? []) as Invoice[]);

  return (
    <>
      <PageHeader title="Production Dashboard" subtitle="Everything that needs attention today." />

      <Section title="Needs action">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="New orders needing action" value={c.newOrders} href="/orders?bucket=new" tone={c.newOrders ? 'warn' : 'neutral'} />
          <StatCard label="Ready made awaiting supplier dispatch" value={c.readyMadeAwaitingDispatch} href="/orders?bucket=rm_dispatch" />
          <StatCard label="Made to order awaiting supplier confirmation" value={c.mtoAwaitingConfirmation} href="/orders?bucket=mto_confirm" />
          <StatCard label="High-risk orders" value={c.highRisk} href="/orders?bucket=high_risk" tone={c.highRisk ? 'danger' : 'neutral'} />
        </div>
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
