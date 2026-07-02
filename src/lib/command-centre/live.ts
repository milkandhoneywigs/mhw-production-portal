import type { SupabaseClient } from '@supabase/supabase-js';

// Live operational metrics computed straight from the production DB (orders +
// invoices) on every load — always fresh, no external API, no sync job. Revenue
// comes separately from GA4 (synced into financial_snapshots). Runs under the
// admin session client (RLS: is_staff/is_admin passes for the owner).

export interface LiveOps {
  // supplier liabilities (from invoices)
  supplierPaymentsDue: number;
  balancePaymentsDue: number;
  unpaidSupplierInvoices: number;
  paidSupplierInvoicesMonth: number;
  invoiceCount: number;
  // production (from orders)
  ordersInProduction: number;
  ordersBlockedByPayment: number;
  overdueCount: number;
  highRiskCount: number;
  highValueCount: number;
  estProductionSpendMonth: number;
  totalActiveOrders: number;
  overdueOrders: { order_number: string; expected_completion_date: string | null; days: number }[];
}

const BLOCKED = new Set(['payment_required', 'balance_payment_required']);
const IN_PROD = new Set(['in_production', 'production_update_due']);

export async function getLiveOps(sb: SupabaseClient): Promise<LiveOps> {
  const [{ data: invoices }, { data: orders }] = await Promise.all([
    sb.from('invoices').select('invoice_type,status,amount,created_at'),
    sb.from('orders').select('order_number,status,risk_level,expected_completion_date,production_complete_at,supplier_price,created_at'),
  ]);
  const inv = (invoices ?? []) as { invoice_type: string; status: string; amount: number | null; created_at: string }[];
  const ord = (orders ?? []) as { order_number: string; status: string; risk_level: string | null; expected_completion_date: string | null; production_complete_at: string | null; supplier_price: number | null }[];

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const amt = (r: { amount: number | null }) => Number(r.amount ?? 0);
  const paymentNeeded = (s: string) => s === 'payment_required' || s === 'uploaded';

  const supplierPaymentsDue = inv.filter((i) => i.invoice_type === 'initial' && paymentNeeded(i.status)).reduce((s, i) => s + amt(i), 0);
  const balancePaymentsDue = inv.filter((i) => i.invoice_type === 'balance' && paymentNeeded(i.status)).reduce((s, i) => s + amt(i), 0);
  const unpaidSupplierInvoices = inv.filter((i) => paymentNeeded(i.status)).reduce((s, i) => s + amt(i), 0);
  const paidSupplierInvoicesMonth = inv.filter((i) => i.status === 'paid' && new Date(i.created_at) >= monthStart).reduce((s, i) => s + amt(i), 0);

  const today = new Date().toISOString().slice(0, 10);
  const active = ord.filter((o) => o.status !== 'completed');
  const overdueOrdersAll = active
    .filter((o) => o.expected_completion_date && o.expected_completion_date < today && !o.production_complete_at)
    .map((o) => ({
      order_number: o.order_number ?? '—',
      expected_completion_date: o.expected_completion_date,
      days: Math.round((Date.now() - new Date(o.expected_completion_date as string).getTime()) / 86400000),
    }));

  return {
    supplierPaymentsDue, balancePaymentsDue, unpaidSupplierInvoices, paidSupplierInvoicesMonth,
    invoiceCount: inv.length,
    ordersInProduction: ord.filter((o) => IN_PROD.has(o.status)).length,
    ordersBlockedByPayment: ord.filter((o) => BLOCKED.has(o.status)).length,
    overdueCount: overdueOrdersAll.length,
    highRiskCount: ord.filter((o) => o.risk_level === 'high').length,
    highValueCount: ord.filter((o) => Number(o.supplier_price ?? 0) >= 1000).length,
    estProductionSpendMonth: ord.reduce((s, o) => s + Number(o.supplier_price ?? 0), 0),
    totalActiveOrders: active.length,
    overdueOrders: overdueOrdersAll,
  };
}
