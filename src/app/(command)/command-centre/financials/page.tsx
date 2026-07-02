import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section } from '@/components/ui';
import { money, type FinancialSnapshot } from '@/lib/command-centre/cc';
import { getLiveOps } from '@/lib/command-centre/live';
import { getRevenueAnalytics } from '@/lib/command-centre/series';
import { TrendCard, TrendBadge } from '@/components/command/TrendCard';
import { RevenueOverTime, SalesByChannel, type ChartDay } from '@/components/command/Charts';

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

const A$ = (v: number | null | undefined) => money(v ?? 0);

export default async function FinancialsPage() {
  await requireAdmin();
  const sb = createClient();
  const [{ data }, ops, rev] = await Promise.all([
    sb.from('financial_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    getLiveOps(sb),
    getRevenueAnalytics(sb, 30),
  ]);
  const F = (data ?? null) as FinancialSnapshot | null;

  // Chart data: current 30 days with the previous 30 days index-aligned as the
  // dotted comparison line.
  const chart: ChartDay[] = rev.current.map((p, i) => ({
    date: p.date, revenue: p.revenue, comparison: rev.previous[i]?.revenue ?? null,
  }));
  const cs = rev.currentStats;

  const channels = [
    { name: 'Online', value: cs.revenue },
    { name: 'In-store (Fresha)', value: Number(F?.instore_revenue ?? 0) },
    { name: 'Outlet', value: Number(F?.outlet_revenue ?? 0) },
  ];
  const totalSales = channels.reduce((s, c) => s + c.value, 0);

  const breakdown = [
    { label: 'Online (website)', value: cs.revenue, change: rev.change.revenue },
    { label: 'In-store (Fresha)', value: Number(F?.instore_revenue ?? 0), change: null },
    { label: 'Outlet', value: Number(F?.outlet_revenue ?? 0), change: null },
    { label: 'Refunds', value: Number(F?.refunds ?? 0), change: null },
  ];

  return (
    <>
      <PageHeader
        title="Financials"
        subtitle="Owner financial dashboard"
        action={
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full px-3 py-1.5 ring-1 ring-beige bg-white font-medium">Last 30 days</span>
            <span className="rounded-full px-3 py-1.5 ring-1 ring-beige bg-white text-muted">Compare to: previous 30 days</span>
          </div>
        }
      />

      {/* Headline + revenue over time (Fresha layout) */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total sales</span>
            <TrendBadge change={rev.change.revenue} />
          </div>
          <div className="text-3xl font-semibold tabular-nums mt-2">{A$(totalSales)}</div>
          <div className="text-[11px] text-muted mb-3">last 30 days · all channels</div>
          <div className="divide-y divide-beige/70">
            {breakdown.map((b) => (
              <div key={b.label} className="py-2 flex items-center justify-between gap-2">
                <span className="text-sm text-ink/80">{b.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm tabular-nums font-medium">{A$(b.value)}</span>
                  {b.change != null && <TrendBadge change={b.change} />}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3">Online = GA4 (live). In-store lands automatically once the Fresha email sync is connected.</p>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Total sales over time</span>
            <span className="text-[11px] text-muted">solid = last 30 days · dotted = previous 30 days</span>
          </div>
          <RevenueOverTime data={chart} />
        </div>
      </div>

      {/* KPI trend row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <TrendCard label="Online sales" value={A$(cs.revenue)} change={rev.change.revenue} />
        <TrendCard label="Average order value" value={cs.aov != null ? A$(cs.aov) : '—'} change={rev.change.aov} />
        <TrendCard label="Orders" value={String(cs.transactions)} change={rev.change.transactions} />
        <TrendCard label="Conversion rate" value={cs.conversion != null ? `${cs.conversion.toFixed(2)}%` : '—'} change={rev.change.conversion} />
        <TrendCard label="Sessions" value={cs.sessions.toLocaleString('en-AU')} change={rev.change.sessions} />
      </div>

      {/* Sales by channel */}
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Sales by channel</span>
            <span className="text-[11px] text-muted">last 30 days</span>
          </div>
          <SalesByChannel data={channels} />
        </div>
        <div className="card p-5">
          <span className="text-sm font-semibold">Production / supplier liabilities</span>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Fin label="Supplier payments required" value={A$(ops.supplierPaymentsDue)} tone={ops.supplierPaymentsDue ? 'warn' : 'neutral'} />
            <Fin label="Balance payments required" value={A$(ops.balancePaymentsDue)} tone={ops.balancePaymentsDue ? 'danger' : 'neutral'} />
            <Fin label="Orders blocked by payment" value={String(ops.ordersBlockedByPayment)} tone={ops.ordersBlockedByPayment ? 'danger' : 'neutral'} />
            <Fin label="Overdue in production" value={String(ops.overdueCount)} tone={ops.overdueCount ? 'danger' : 'neutral'} />
            <Fin label="Orders in production" value={String(ops.ordersInProduction)} tone="honey" />
            <Fin label="Paid supplier invoices (month)" value={A$(ops.paidSupplierInvoicesMonth)} tone="good" />
          </div>
          {ops.invoiceCount === 0 && <p className="text-[11px] text-muted mt-2">No supplier invoices yet — figures populate automatically when suppliers price orders in the production portal.</p>}
        </div>
      </div>

      <Section title="Cashflow Watch">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Fin label="Upcoming supplier payments" value={A$(ops.supplierPaymentsDue)} tone={ops.supplierPaymentsDue ? 'warn' : 'neutral'} />
          <Fin label="Balance held (blocked orders)" value={A$(ops.balancePaymentsDue)} tone={ops.balancePaymentsDue ? 'danger' : 'neutral'} />
          <Fin label="Customer refunds pending" value={A$(F?.refunds)} tone="warn" />
        </div>
        <p className="text-xs text-muted mt-2">Customer-paid-not-yet-sent orders, complaint/refund risk and large upcoming expenses populate once Shopify/Xero connect.</p>
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
        <p className="text-xs text-muted mt-2">Revenue series = GA4 daily (synced by the 6am routine). Supplier liabilities &amp; production = live from the production DB. No payments are processed here.</p>
      </Section>
    </>
  );
}
