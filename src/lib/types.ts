// Row types mirroring the Supabase schema (0001_init.sql).
import type { Role, OrderType, RiskLevel, OrderStatus } from './constants';

export type OrderSource = 'shopify' | 'fresha' | 'manual' | 'custom' | 'other';
export type ShippingDestination = 'customer_direct' | 'mhw_showroom' | 'qld_showroom' | 'other';
export type InvoiceType = 'initial' | 'balance' | 'other';
export type InvoiceStatus = 'uploaded' | 'payment_required' | 'paid' | 'disputed' | 'cancelled';
export type PaymentMethod = 'bank_transfer' | 'paypal' | 'other';
export type TrackingType = 'supplier_to_customer' | 'supplier_to_showroom' | 'showroom_to_customer';
export type CustomerUpdateType =
  | 'order_received' | 'production_started' | 'production_checkin'
  | 'production_complete' | 'arrived_showroom' | 'dispatched' | 'delay' | 'custom';
export type CustomerUpdateStatus = 'draft' | 'approved' | 'sent' | 'skipped';
export type QcStatus = 'pending' | 'passed' | 'failed' | 'manager_review';
export type SupplierUpdateType =
  | 'confirmation' | 'invoice_uploaded' | 'production_update'
  | 'production_complete' | 'tracking_uploaded' | 'delay_notice' | 'general_note';
export type FileType = 'invoice' | 'qc_photo' | 'supplier_attachment' | 'other';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  supplier_id: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  created_at: string;
}

export interface ProductMapping {
  id: string;
  style_name: string;
  supplier_style_code: string;
  default_cap_style: string | null;
  default_density: string | null;
  default_hair_type: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  source: OrderSource;
  customer_id: string | null;
  supplier_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  risk_level: RiskLevel;
  assigned_staff_id: string | null;
  customer_facing_product_name: string | null;
  internal_style_name: string | null;
  supplier_style_code: string | null;
  customer_ordered_length: string | null;
  supplier_order_length: string | null;
  cap_style: string | null;
  cap_size: string | null;
  density: string | null;
  hair_type: string | null;
  colour_notes: string | null;
  production_notes: string | null;
  internal_notes: string | null; // never sent to suppliers
  shipping_destination: ShippingDestination;
  date_ordered: string;
  date_sent_to_supplier: string | null;
  supplier_confirmed_at: string | null;
  production_started_at: string | null;
  expected_completion_date: string | null;
  production_complete_at: string | null;
  shipped_to_showroom_at: string | null;
  arrived_at_showroom_at: string | null;
  qc_completed_at: string | null;
  dispatched_to_customer_at: string | null;
  completed_at: string | null;
  last_customer_update_at: string | null;
  next_customer_update_due: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  supplier_id: string | null;
  invoice_type: InvoiceType;
  invoice_number: string | null;
  amount: number | null;
  currency: string;
  file_url: string | null;
  uploaded_by: string | null;
  status: InvoiceStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tracking {
  id: string;
  order_id: string;
  tracking_type: TrackingType;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface SupplierUpdate {
  id: string;
  order_id: string;
  supplier_id: string | null;
  update_type: SupplierUpdateType;
  message: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CustomerUpdate {
  id: string;
  order_id: string;
  update_type: CustomerUpdateType;
  subject: string | null;
  message: string | null;
  status: CustomerUpdateStatus;
  created_by: string | null;
  approved_by: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface QcCheck {
  id: string;
  order_id: string;
  checked_by: string | null;
  correct_style: boolean;
  correct_colour: boolean;
  correct_length: boolean;
  correct_cap_size: boolean;
  correct_density: boolean;
  lace_checked: boolean;
  no_visible_faults: boolean;
  notes: string | null;
  status: QcStatus;
  created_at: string;
}

// Order joined with its customer + supplier (common read shape).
export interface OrderWithRelations extends Order {
  customer?: Customer | null;
  supplier?: Supplier | null;
}
