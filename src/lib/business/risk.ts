// -----------------------------------------------------------------------------
// Risk calculation (deterministic v1).
//
// calculateRiskLevel derives a low/medium/high flag from order + invoice signals.
// AI can later add predictive risk; for now these are transparent rules the team
// can trust. Called when rendering dashboards and when invoices/orders change.
// -----------------------------------------------------------------------------
import type { RiskLevel } from '../constants';
import { INVOICE_MEDIUM_RISK_HOURS, INVOICE_HIGH_RISK_HOURS } from '../constants';
import type { Order, Invoice } from '../types';

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
}

export interface RiskResult {
  level: RiskLevel;
  reasons: string[];
}

export function calculateRiskLevel(order: Order, invoices: Invoice[] = []): RiskResult {
  const reasons: string[] = [];
  let level: RiskLevel = 'low';
  const bump = (to: RiskLevel, reason: string) => {
    reasons.push(reason);
    const rank = { low: 0, medium: 1, high: 2 } as const;
    if (rank[to] > rank[level]) level = to;
  };

  // Explicit at-risk statuses.
  if (order.status === 'delayed_at_risk') bump('high', 'Order marked delayed / at risk');
  if (order.status === 'manager_review_required') bump('medium', 'Awaiting manager review');
  if (order.order_type === 'needs_review') bump('medium', 'Order needs review (unparsed length / classification)');

  // Overdue production.
  if (
    order.expected_completion_date &&
    !order.production_complete_at &&
    new Date(order.expected_completion_date).getTime() < Date.now()
  ) {
    bump('high', 'Production is past its expected completion date');
  }

  // Customer update overdue.
  if (order.next_customer_update_due && new Date(order.next_customer_update_due).getTime() < Date.now()) {
    bump('medium', 'Customer update is overdue');
  }

  // Unpaid invoices ageing (24h -> medium, 48h -> high).
  for (const inv of invoices) {
    if (inv.status === 'uploaded' || inv.status === 'payment_required') {
      const h = hoursSince(inv.created_at);
      if (h !== null && h >= INVOICE_HIGH_RISK_HOURS) {
        bump('high', `Invoice ${inv.invoice_number ?? ''} unpaid for over ${INVOICE_HIGH_RISK_HOURS}h`);
      } else if (h !== null && h >= INVOICE_MEDIUM_RISK_HOURS) {
        bump('medium', `Invoice ${inv.invoice_number ?? ''} unpaid for over ${INVOICE_MEDIUM_RISK_HOURS}h`);
      }
    }
  }

  // Production complete but balance unpaid -> shipment blocked (high).
  const balanceUnpaid = invoices.some(
    (i) => i.invoice_type === 'balance' && i.status !== 'paid' && i.status !== 'cancelled',
  );
  if (order.production_complete_at && balanceUnpaid) {
    bump('high', 'Production complete but balance invoice unpaid — shipment blocked');
  }

  return { level, reasons };
}

// Is this order's shipment blocked by an unpaid balance invoice?
export function isShipmentBlocked(order: Order, invoices: Invoice[]): boolean {
  const balanceUnpaid = invoices.some(
    (i) => i.invoice_type === 'balance' && i.status !== 'paid' && i.status !== 'cancelled',
  );
  return Boolean(order.production_complete_at) && balanceUnpaid;
}
