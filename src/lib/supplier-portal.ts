// -----------------------------------------------------------------------------
// Supplier portal domain logic: sections, tab -> status mappings, and the ONE
// primary action a supplier sees for each order status. Tabs map onto the
// existing order_status enum — there is no parallel state machine.
// -----------------------------------------------------------------------------
import type { OrderStatus, OrderType } from './constants';
import { SUPPLIER_VISIBLE_ORDER_TYPES } from './constants';

export interface SupplierSection {
  href: string;
  label: string;
  orderType: OrderType | null; // null = not an order list (payments / messages)
  icon: string;
}

const ALL_SECTIONS: SupplierSection[] = [
  { href: '/supplier/ready-to-ship', label: 'Ready to Ship Orders', orderType: 'ready_made', icon: '📦' },
  { href: '/supplier/made-to-order', label: 'Made to Order', orderType: 'made_to_order', icon: '🧵' },
  { href: '/supplier/bulk-orders', label: 'Bulk Store Orders', orderType: 'stock', icon: '🏬' },
  { href: '/supplier/payments', label: 'Payments / Invoicing', orderType: null, icon: '💳' },
  { href: '/supplier/messages', label: 'Messages', orderType: null, icon: '✉️' },
];

// Phased rollout: sections tied to a hidden order type disappear entirely.
export function visibleSections(): SupplierSection[] {
  return ALL_SECTIONS.filter(
    (s) => s.orderType === null || (SUPPLIER_VISIBLE_ORDER_TYPES as string[]).includes(s.orderType),
  );
}

// ---------------------------------------------------------------------------
// Tab -> status mappings per section
// ---------------------------------------------------------------------------
export interface StatusTab { key: string; label: string; statuses: OrderStatus[] }

export const READY_TO_SHIP_TABS: StatusTab[] = [
  { key: 'new', label: 'New', statuses: ['new_ready_made_order'] },
  { key: 'confirmed', label: 'Confirmed', statuses: ['supplier_notified'] },
  { key: 'dispatch', label: 'Ready to Dispatch', statuses: ['awaiting_dhl_tracking'] },
  { key: 'shipped', label: 'Shipped', statuses: ['tracking_uploaded', 'customer_notified'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

export const MADE_TO_ORDER_TABS: StatusTab[] = [
  { key: 'new', label: 'New', statuses: ['new_made_to_order', 'awaiting_supplier_confirmation'] },
  { key: 'confirmed', label: 'Confirmed', statuses: ['invoice_uploaded', 'payment_required', 'payment_paid'] },
  { key: 'production', label: 'In Production', statuses: ['in_production', 'production_update_due', 'delayed_at_risk'] },
  { key: 'qc', label: 'Quality Check', statuses: ['production_complete', 'qc_required', 'manager_review_required'] },
  { key: 'ready', label: 'Ready to Ship', statuses: ['balance_payment_required', 'balance_paid', 'ready_to_dispatch'] },
  { key: 'shipped', label: 'Shipped', statuses: ['shipped_to_showroom', 'arrived_at_showroom', 'dispatched_to_customer'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
  { key: 'on_hold', label: 'On Hold', statuses: ['on_hold'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

// ---------------------------------------------------------------------------
// The ONE primary action per status (plus "Report a problem", always offered).
// ---------------------------------------------------------------------------
export type SupplierActionKey =
  | 'confirm' | 'add_price' | 'ready_to_dispatch' | 'upload_tracking'
  | 'upload_invoice' | 'start_production' | 'add_update' | 'production_complete'
  | 'upload_qc_photos' | 'none';

export interface PrimaryAction { key: SupplierActionKey; label: string; help: string }

const RM_ACTIONS: Partial<Record<OrderStatus, PrimaryAction>> = {
  new_ready_made_order: { key: 'confirm', label: 'Confirm stock', help: 'Check you have this wig in stock, then confirm.' },
  supplier_notified: { key: 'ready_to_dispatch', label: 'Mark ready to dispatch', help: 'The shipping address is shown below. Pack the order, then mark it ready. Add your order price to request payment.' },
  awaiting_dhl_tracking: { key: 'upload_tracking', label: 'Upload tracking', help: 'Create the DHL shipment and add the tracking number here.' },
  tracking_uploaded: { key: 'upload_invoice', label: 'Upload invoice', help: 'Shipped. Add your invoice for this order.' },
};

const MTO_ACTIONS: Partial<Record<OrderStatus, PrimaryAction>> = {
  new_made_to_order: { key: 'confirm', label: 'Confirm order', help: 'Review the specifications, then confirm you can produce this order.' },
  awaiting_supplier_confirmation: { key: 'add_price', label: 'Add order price', help: 'Confirmed. Add the agreed price for this order.' },
  invoice_uploaded: { key: 'add_update', label: 'Add production update', help: 'Waiting on payment. You can post updates in the meantime.' },
  payment_required: { key: 'add_update', label: 'Add production update', help: 'Waiting on payment from Milk & Honey.' },
  payment_paid: { key: 'start_production', label: 'Start production', help: 'Payment received — start production when work begins.' },
  in_production: { key: 'production_complete', label: 'Mark production complete', help: 'Post progress updates, then mark complete when finished.' },
  production_update_due: { key: 'add_update', label: 'Add production update', help: 'An update is due — tell Milk & Honey how production is going.' },
  production_complete: { key: 'upload_qc_photos', label: 'Upload QC photos', help: 'Upload clear photos of the finished wig for approval.' },
  qc_required: { key: 'upload_qc_photos', label: 'Upload QC photos', help: 'Milk & Honey is waiting on quality-control photos.' },
  balance_payment_required: { key: 'add_update', label: 'Add update', help: 'Waiting on the balance payment from Milk & Honey.' },
  balance_paid: { key: 'upload_tracking', label: 'Upload tracking', help: 'Balance paid — ship to the Milk & Honey showroom and add tracking.' },
  ready_to_dispatch: { key: 'upload_tracking', label: 'Upload tracking', help: 'Ship this order and add the tracking number.' },
  shipped_to_showroom: { key: 'upload_invoice', label: 'Upload invoice', help: 'Shipped. Add your final invoice if you have not already.' },
  delayed_at_risk: { key: 'add_update', label: 'Add production update', help: 'This order is flagged as delayed — please update Milk & Honey.' },
};

export function primaryActionFor(orderType: OrderType, status: OrderStatus): PrimaryAction | null {
  const map = orderType === 'ready_made' ? RM_ACTIONS : MTO_ACTIONS;
  return map[status] ?? null;
}

// Statuses where the supplier currently owes an action (drives badges + tasks).
export const SUPPLIER_ACTIONABLE: Record<'ready_made' | 'made_to_order' | 'stock', OrderStatus[]> = {
  ready_made: ['new_ready_made_order', 'supplier_notified', 'awaiting_dhl_tracking'],
  made_to_order: [
    'new_made_to_order', 'awaiting_supplier_confirmation', 'payment_paid',
    'in_production', 'production_update_due', 'production_complete', 'qc_required',
    'balance_paid', 'ready_to_dispatch', 'delayed_at_risk',
  ],
  stock: ['new_made_to_order', 'in_production'],
};

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}
