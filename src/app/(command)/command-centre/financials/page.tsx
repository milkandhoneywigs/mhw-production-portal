import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { money, type FinancialSnapshot } from '@/lib/command-centre/cc';
import { getLiveOps } from '@/lib/command-centre/live';

export const dynamic = 'force-dynamic';

function Fin({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warn' | 'danger' | 'good' | 'honey' }) {
  const num = tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : tone === 'honey' ? 'text-honey' : 'text-ink';
  return (
    <div className="card p-4">
      <div className={`text-xl font-semibold tabular-nums ${num}`}>{value}</div>
      <div className="text-xs text-muted mt-1 leading-snug">{label}</div>
    </div>
  );
}

// Connected (read-only) via the Supermetrics connection; the rest are planned.
const CONNECTED = ['Google Analytics (GA4)', 'Google Ads', 'Meta Ads', 'Klaviyo', 'Gorgias'];
const PLANNED = ['Shopify', 'Fresha (in-store)', 'Xero', 'PayPal', 'Bank feed', 'Omnisend'];

export default async function FinancialsPage() {
  await requireAdmin();
  const sb = createClient();
  const { data } = await sb.from('financial_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle();
  const F = (data ?? null) as FinancialSnapshot | null;
  const ops = await getLiveOps(sb); // supplier liabilities + production, live from the DB

  return (
    <>
      <PageHeader title="Financials" subtitle="Owner financial dashboard" />
      <div className="card p-3 mb-6 ring-1 ring-beige bg-cream text-xs text-ink/80">
        <b>Revenue</b> = live from GA4 (website). <b>Supplier liabilities &amp; production</b> = live from the production DB.
        {F?.notes ? ` ${F.notes}` : ''} Shopify/Xero/PayPal/bank not yet connected; no payments are processed here.
      </div>

      <Section title="Revenue Overview (GA4 · website)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Fin label="Today's revenue" value={money(F?.today_revenue)} />
          <Fin label="Last 7 days" value={money(F?.week_revenue)} tone="good" />
          <Fin label="Month to date" value={money(F?.month_revenue)} tone="honey" />
          <Fin label="Online revenue (MTD)" value={money(F?.online_revenue)} />
          <Fin label="In-store revenue (Fresha)" value={F?.instore_revenue ? money(F.instore_revenue) : '—'} />
          <Fin label="Outlet revenue" value={F?.outlet_revenue ? money(F.outlet_revenue) : '—'} />
          <Fin label="Refunds" value={money(F?.refunds)} tone="warn" />
          <Fin label="Net sales (MTD)" value={money(F?.net_sales)} tone="good" />
        </div>
        <p className="text-xs text-muted mt-2">In-store revenue will come from <b>Fresha</b> (all in-store bookings &amp; sales); Outlet via its own Shopify. Not in this GA4 property yet.</p>
      </Section>

      <Section title="Production / Supplier Liabilities (live from production DB)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Fin label="Supplier payments required" value={money(ops.supplierPaymentsDue)} tone={ops.supplierPaymentsDue ? 'warn' : 'neutral'} />
          <Fin label="Balance payments required" value={money(ops.balancePaymentsDue)} tone={ops.balancePaymentsDue ? 'danger' : 'neutral'} />
          <Fin label="Unpaid supplier invoices" value={money(ops.unpaidSupplierInvoices)} tone={ops.unpaidSupplierInvoices ? 'warn' : 'neutral'} />
          <Fin label="Orders blocked by payment" value={String(ops.ordersBlockedByPayment)} tone={ops.ordersBlockedByPayment ? 'danger' : 'neutral'} />
          <Fin label="Orders in production" value={String(ops.ordersInProduction)} tone="honey" />
          <Fin label="Overdue in production" value={String(ops.overdueCount)} tone={ops.overdueCount ? 'danger' : 'neutral'} />
          <Fin label="High-value orders in production" value={String(ops.highValueCount)} />
          <Fin label="Paid supplier invoices (month)" value={money(ops.paidSupplierInvoicesMonth)} tone="good" />
        </div>
        {ops.invoiceCount === 0 && <p className="text-xs text-muted mt-2">No supplier invoices in the portal yet (suppliers price orders via the production portal → invoices appear here automatically).</p>}
      </Section>

      <Section title="Cashflow Watch">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Fin label="Upcoming supplier payments" value={money(ops.supplierPaymentsDue)} tone={ops.supplierPaymentsDue ? 'warn' : 'neutral'} />
          <Fin label="Balance held (blocked orders)" value={money(ops.balancePaymentsDue)} tone={ops.balancePaymentsDue ? 'danger' : 'neutral'} />
          <Fin label="Customer refunds pending" value={money(F?.refunds)} tone="warn" />
        </div>
        <p className="text-xs text-muted mt-2">Orders paid by customer but not yet sent to supplier, complaint/refund risk, and large upcoming expenses will populate here once Shopify/Xero connect.</p>
      </Section>

      <Section title="Data connections">
        <div className="flex flex-wrap gap-2">
          {CONNECTED.map((i) => (
            <span key={i} className="text-xs rounded-full px-3 py-1 ring-1 ring-emerald-200 bg-emerald-50 text-emerald-700">{i} · connected (Supermetrics)</span>
          ))}
          {PLANNED.map((i) => (
            <span key={i} className="text-xs rounded-full px-3 py-1 ring-1 ring-beige bg-white text-muted">{i} · planned</span>
          ))}
        </div>
        <p className="text-xs text-muted mt-2">Connected sources are readable now via Supermetrics. Today only GA4 revenue feeds this dashboard — the daily sync can be extended to pull Google/Meta spend, Klaviyo and Gorgias into the snapshot too.</p>
      </Section>
    </>
  );
}
