// Central constants: roles, statuses, labels, badge styling.
// Kept in one place so the DB enums, the UI, and the business logic never drift.

export type Role = 'admin' | 'staff' | 'supplier';
export type OrderType = 'ready_made' | 'made_to_order' | 'stock' | 'needs_review';
export type RiskLevel = 'low' | 'medium' | 'high';

export const READY_MADE_STATUSES = [
  'new_ready_made_order',
  'supplier_notified',
  'awaiting_dhl_tracking',
  'tracking_uploaded',
  'customer_notified',
  'completed',
] as const;

export const MADE_TO_ORDER_STATUSES = [
  'new_made_to_order',
  'awaiting_supplier_confirmation',
  'invoice_uploaded',
  'payment_required',
  'payment_paid',
  'in_production',
  'production_update_due',
  'production_complete',
  'balance_payment_required',
  'balance_paid',
  'shipped_to_showroom',
  'arrived_at_showroom',
  'qc_required',
  'qc_passed',
  'ready_to_dispatch',
  'dispatched_to_customer',
  'delayed_at_risk',
  'manager_review_required',
  'completed',
] as const;

export type OrderStatus =
  | (typeof READY_MADE_STATUSES)[number]
  | (typeof MADE_TO_ORDER_STATUSES)[number];

// Human-readable labels for every status.
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new_ready_made_order: 'New Ready Made Order',
  supplier_notified: 'Supplier Notified',
  awaiting_dhl_tracking: 'Awaiting DHL Tracking',
  tracking_uploaded: 'Tracking Uploaded',
  customer_notified: 'Customer Notified',
  new_made_to_order: 'New Made To Order',
  awaiting_supplier_confirmation: 'Awaiting Supplier Confirmation',
  invoice_uploaded: 'Invoice Uploaded',
  payment_required: 'Payment Required',
  payment_paid: 'Payment Paid',
  in_production: 'In Production',
  production_update_due: 'Production Update Due',
  production_complete: 'Production Complete',
  balance_payment_required: 'Balance Payment Required',
  balance_paid: 'Balance Paid',
  shipped_to_showroom: 'Shipped To Showroom',
  arrived_at_showroom: 'Arrived At Showroom',
  qc_required: 'QC Required',
  qc_passed: 'QC Passed',
  ready_to_dispatch: 'Ready To Dispatch',
  dispatched_to_customer: 'Dispatched To Customer',
  delayed_at_risk: 'Delayed / At Risk',
  manager_review_required: 'Manager Review Required',
  completed: 'Completed',
};

// Badge colour token per status. Maps to Tailwind classes in StatusBadge.
export type BadgeTone =
  | 'new' | 'production' | 'payment' | 'balance' | 'blocked'
  | 'risk' | 'qc' | 'ready' | 'done' | 'neutral';

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  new_ready_made_order: 'new',
  new_made_to_order: 'new',
  supplier_notified: 'neutral',
  awaiting_supplier_confirmation: 'neutral',
  awaiting_dhl_tracking: 'neutral',
  tracking_uploaded: 'ready',
  customer_notified: 'done',
  invoice_uploaded: 'payment',
  payment_required: 'payment',
  payment_paid: 'ready',
  in_production: 'production',
  production_update_due: 'risk',
  production_complete: 'ready',
  balance_payment_required: 'balance',
  balance_paid: 'ready',
  shipped_to_showroom: 'production',
  arrived_at_showroom: 'qc',
  qc_required: 'qc',
  qc_passed: 'ready',
  ready_to_dispatch: 'ready',
  dispatched_to_customer: 'done',
  delayed_at_risk: 'risk',
  manager_review_required: 'risk',
  completed: 'done',
};

export const TONE_CLASSES: Record<BadgeTone, string> = {
  new: 'bg-blue-50 text-blue-700 ring-blue-200',
  production: 'bg-violet-50 text-violet-700 ring-violet-200',
  payment: 'bg-amber-50 text-amber-800 ring-amber-200',
  balance: 'bg-orange-50 text-orange-800 ring-orange-200',
  blocked: 'bg-red-50 text-red-700 ring-red-200',
  risk: 'bg-red-50 text-red-700 ring-red-200',
  qc: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  ready: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  done: 'bg-gray-100 text-gray-600 ring-gray-200',
  neutral: 'bg-sand text-ink ring-beige',
};

// Big, obvious operational labels used across the UI.
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  ready_made: 'READY MADE',
  made_to_order: 'MADE TO ORDER',
  stock: 'STOCK',
  needs_review: 'NEEDS REVIEW',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'AT RISK',
  high: 'AT RISK',
};

// Supplier shipping instruction lines (exact wording per spec).
export const SUPPLIER_INSTRUCTION_SHIPPING = {
  ready_made:
    'Ship directly to customer via DHL. Do not ship to Milk & Honey showroom.',
  made_to_order:
    'Produce this order and ship to Milk & Honey showroom once complete. Do not ship directly to customer.',
} as const;

// Milk & Honey showroom destination (used on made-to-order supplier instructions).
export const MHW_SHOWROOM_ADDRESS =
  'Milk & Honey Wigs, Shop 5 / 1-7 Boyle Street, Sutherland NSW 2232 (entrance on Eton Street)';

// Billing risk thresholds (hours an invoice can sit unpaid).
export const INVOICE_MEDIUM_RISK_HOURS = 24;
export const INVOICE_HIGH_RISK_HOURS = 48;
