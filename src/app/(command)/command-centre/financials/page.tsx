import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { money, type FinancialSnapshot } from '@/lib/command-centre/cc';

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

const INTEGRATIONS = ['Shopify', 'Xero', 'PayPal', 'Bank feed', 'Gorgias', 'Google Ads', 'Meta Ads', 'Klaviyo', 'Omnisend'];

export default async function FinancialsPage() {
  await requireAdmin();
  const sb = createClient();
  const { data } = await sb.from('financial_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle();
  const F = (data ?? null) as FinancialSnapshot | null;

  if (!F) return (<><PageHeader title="Financials" /><EmptyState>No financial snapshot yet.</EmptyState></>);

  return (
    <>
      <PageHeader title="Financials" subtitle={`Owner financial dashboard · snapshot ${F.snapshot_date}`} />
      <div className="card p-3 mb-6 ring-1 ring-amber-200 bg-amber-50 text-xs text-amber-800">
        DEMO / placeholder values. External finance systems (Shopify, Xero, PayPal, bank) are not connected yet and no payments are processed here.
      </div>

      <Section title="Revenue Overview">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Fin label="Today's revenue" value={money(F.today_revenue)} />
          <Fin label="This week" value={money(F.week_revenue)} />
          <Fin label="This month" value={money(F.month_revenue)} tone="honey" />
          <Fin label="Average order value" value="—" />
          <Fin label="Online revenue" value={money(F.online_revenue)} />
          <Fin label="In-store revenue" value={money(F.instore_revenue)} />
          <Fin label="Outlet revenue" value={money(F.outlet_revenue)} />
          <Fin label="Refunds" value={money(F.refunds)} tone="warn" />
          <Fin label="Net sales" value={money(F.net_sales)} tone="good" />
        </div>
      </Section>

      <Section title="Production / Supplier Liabilities">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Fin label="Supplier payments required" value={money(F.supplier_payments_due)} tone="warn" />
          <Fin label="Balance payments required" value={money(F.balance_payments_due)} tone="danger" />
          <Fin label="Unpaid supplier invoices" value={money(F.unpaid_supplier_invoices)} tone="warn" />
          <Fin label="Orders blocked by payment" value={String(F.orders_blocked_by_payment)} tone={F.orders_blocked_by_payment ? 'danger' : 'neutral'} />
          <Fin label="Est. production spend (month)" value={money(F.estimated_production_spend_month)} />
          <Fin label="Paid supplier invoices (month)" value={money(F.paid_supplier_invoices_month)} tone="good" />
        </div>
      </Section>

      <Section title="Cashflow Watch">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Fin label="Upcoming supplier payments" value={money(F.supplier_payments_due)} tone="warn" />
          <Fin label="Balance held (blocked orders)" value={money(F.balance_payments_due)} tone="danger" />
          <Fin label="Customer refunds pending" value={money(F.refunds)} tone="warn" />
        </div>
        <p className="text-xs text-muted mt-2">Orders paid by customer but not yet sent to supplier, complaint/refund risk, and large upcoming expenses will populate here once live data connects.</p>
      </Section>

      <Section title="Future integrations (planned)">
        <div className="flex flex-wrap gap-2">
          {INTEGRATIONS.map((i) => (
            <span key={i} className="text-xs rounded-full px-3 py-1 ring-1 ring-beige bg-white text-muted">{i} · planned</span>
          ))}
        </div>
      </Section>
    </>
  );
}
