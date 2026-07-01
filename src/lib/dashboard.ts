// Deterministic dashboard bucketing. Given the active orders + unpaid invoices,
// compute the counts for each admin/staff dashboard card. Keeping this pure makes
// the numbers auditable and easy to test.
import type { Order, Invoice } from './types';
import { calculateRiskLevel, isShipmentBlocked } from './business/risk';

const now = () => Date.now();
const overdue = (iso: string | null) => !!iso && new Date(iso).getTime() < now();

export interface DashboardCounts {
  newOrders: number;
  readyMadeAwaitingDispatch: number;
  mtoAwaitingConfirmation: number;
  invoicesRequiringPayment: number;
  balancePaymentsRequired: number;
  inProduction: number;
  productionOverdue: number;
  supplierUpdatesDue: number;
  customerUpdatesDue: number;
  arrivedQc: number;
  readyToDispatch: number;
  highRisk: number;
}

export function computeDashboard(orders: Order[], invoices: Invoice[]): DashboardCounts {
  const invByOrder = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    const arr = invByOrder.get(inv.order_id) ?? [];
    arr.push(inv);
    invByOrder.set(inv.order_id, arr);
  }
  const unpaid = (i: Invoice) => i.status === 'uploaded' || i.status === 'payment_required';

  let c: DashboardCounts = {
    newOrders: 0, readyMadeAwaitingDispatch: 0, mtoAwaitingConfirmation: 0,
    invoicesRequiringPayment: 0, balancePaymentsRequired: 0, inProduction: 0,
    productionOverdue: 0, supplierUpdatesDue: 0, customerUpdatesDue: 0,
    arrivedQc: 0, readyToDispatch: 0, highRisk: 0,
  };

  for (const o of orders) {
    const invs = invByOrder.get(o.id) ?? [];

    if (o.status === 'new_ready_made_order' || o.status === 'new_made_to_order' || o.order_type === 'needs_review')
      c.newOrders++;

    if (o.order_type === 'ready_made' &&
        ['new_ready_made_order', 'supplier_notified', 'awaiting_dhl_tracking'].includes(o.status))
      c.readyMadeAwaitingDispatch++;

    if (o.status === 'new_made_to_order' || o.status === 'awaiting_supplier_confirmation')
      c.mtoAwaitingConfirmation++;

    if (o.status === 'in_production' || o.status === 'production_update_due') c.inProduction++;
    if (o.status === 'production_update_due') c.supplierUpdatesDue++;

    if (o.expected_completion_date && !o.production_complete_at && overdue(o.expected_completion_date))
      c.productionOverdue++;

    if (overdue(o.next_customer_update_due)) c.customerUpdatesDue++;

    if (o.status === 'arrived_at_showroom' || o.status === 'qc_required') c.arrivedQc++;
    if (o.status === 'ready_to_dispatch') c.readyToDispatch++;

    // balance required (either flagged status or an unpaid balance invoice on a complete order)
    if (o.status === 'balance_payment_required' || isShipmentBlocked(o, invs)) c.balancePaymentsRequired++;

    // live risk (order + its invoices)
    if (calculateRiskLevel(o, invs).level === 'high') c.highRisk++;
  }

  // invoices requiring initial payment (unpaid, not balance)
  c.invoicesRequiringPayment = invoices.filter((i) => unpaid(i) && i.invoice_type !== 'balance').length;

  return c;
}
