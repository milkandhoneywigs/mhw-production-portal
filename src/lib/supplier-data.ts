import 'server-only';
import { createClient } from './supabase/server';
import { SUPPLIER_VISIBLE_ORDER_TYPES, type OrderStatus, type OrderType } from './constants';
import { SUPPLIER_ACTIONABLE, daysUntil, primaryActionFor } from './supplier-portal';
import type { Invoice, OrderMessage } from './types';

// The supplier-safe order shape (v_supplier_orders, post-0007).
export interface SupplierOrderRow {
  id: string;
  order_number: string;
  supplier_reference: string | null;
  order_type: OrderType;
  status: OrderStatus;
  supplier_id: string;
  customer_facing_product_name: string | null;
  internal_style_name: string | null;
  supplier_style_code: string | null;
  supplier_order_length: string | null;
  cap_style: string | null;
  cap_size: string | null;
  density: string | null;
  hair_type: string | null;
  colour_notes: string | null;
  production_notes: string | null;
  shipping_destination: string | null;
  quantity: number;
  supplier_price: number | null;
  date_ordered: string;
  date_sent_to_supplier: string | null;
  supplier_confirmed_at: string | null;
  production_started_at: string | null;
  expected_completion_date: string | null;
  production_complete_at: string | null;
  shipped_to_showroom_at: string | null;
  cancelled_at: string | null;
  on_hold_at: string | null;
  created_at: string;
  updated_at: string;
}

// All orders the supplier may see under the current rollout phase. RLS scopes
// rows to their supplier_id; the phase flag scopes order types.
export async function fetchSupplierOrders(orderType?: OrderType): Promise<SupplierOrderRow[]> {
  const supabase = createClient();
  const types = orderType ? [orderType] : (SUPPLIER_VISIBLE_ORDER_TYPES as readonly string[]);
  const { data } = await supabase
    .from('v_supplier_orders')
    .select('*')
    .in('order_type', types as string[])
    .order('created_at', { ascending: false });
  return (data ?? []) as SupplierOrderRow[];
}

// Threads with a message from the other side newer than the viewer's last read.
export async function fetchUnreadOrderIds(profileId: string, isSupplier: boolean): Promise<Set<string>> {
  const supabase = createClient();
  const [{ data: msgs }, { data: reads }] = await Promise.all([
    supabase.from('order_messages').select('order_id, sender_role, created_at').order('created_at', { ascending: false }),
    supabase.from('order_message_reads').select('order_id, last_read_at').eq('profile_id', profileId),
  ]);
  const lastRead = new Map((reads ?? []).map((r) => [r.order_id as string, r.last_read_at as string]));
  const otherRoles = isSupplier ? ['staff', 'admin'] : ['supplier'];
  const unread = new Set<string>();
  const seen = new Set<string>();
  for (const m of (msgs ?? []) as { order_id: string; sender_role: string | null; created_at: string }[]) {
    if (seen.has(m.order_id)) continue;
    seen.add(m.order_id); // only the LATEST message per thread decides
    if (!m.sender_role || !otherRoles.includes(m.sender_role)) continue;
    const read = lastRead.get(m.order_id);
    if (!read || m.created_at > read) unread.add(m.order_id);
  }
  return unread;
}

export interface SupplierTask {
  orderId: string;
  orderNumber: string;
  orderType: OrderType;
  label: string;      // e.g. "Confirm stock"
  detail: string;     // product line
  href: string;
  urgent: boolean;    // overdue or delayed
}

// "Tasks requiring action" — one row per order the supplier currently owes a step on.
export function buildTasks(orders: SupplierOrderRow[], unread: Set<string>): SupplierTask[] {
  const tasks: SupplierTask[] = [];
  for (const o of orders) {
    const actionable = SUPPLIER_ACTIONABLE[o.order_type as keyof typeof SUPPLIER_ACTIONABLE] ?? [];
    if (!actionable.includes(o.status)) continue;
    const action = primaryActionFor(o.order_type, o.status);
    if (!action) continue;
    const days = daysUntil(o.expected_completion_date);
    tasks.push({
      orderId: o.id,
      orderNumber: o.order_number,
      orderType: o.order_type,
      label: action.label,
      detail: [o.internal_style_name, o.supplier_order_length, o.colour_notes].filter(Boolean).join(' · '),
      href: `/supplier/orders/${o.id}`,
      urgent: o.status === 'delayed_at_risk' || (days !== null && days < 0),
    });
  }
  for (const orderId of unread) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) continue;
    tasks.push({
      orderId,
      orderNumber: o.order_number,
      orderType: o.order_type,
      label: 'Reply to message',
      detail: [o.internal_style_name, o.supplier_order_length].filter(Boolean).join(' · '),
      href: `/supplier/orders/${orderId}#messages`,
      urgent: false,
    });
  }
  return tasks.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

// Sidebar badge counts, keyed by section href.
export async function fetchBadgeCounts(profileId: string): Promise<Record<string, number>> {
  const orders = await fetchSupplierOrders();
  const unread = await fetchUnreadOrderIds(profileId, true);
  const supabase = createClient();
  const { data: invs } = await supabase.from('invoices').select('id, status');
  const invoiceActions = ((invs ?? []) as Pick<Invoice, 'id' | 'status'>[])
    .filter((i) => i.status === 'changes_requested').length;

  const countFor = (type: OrderType) =>
    orders.filter((o) => o.order_type === type &&
      (SUPPLIER_ACTIONABLE[type as keyof typeof SUPPLIER_ACTIONABLE] ?? []).includes(o.status)).length;

  return {
    '/supplier/ready-to-ship': countFor('ready_made'),
    '/supplier/made-to-order': countFor('made_to_order'),
    '/supplier/bulk-orders': countFor('stock'),
    '/supplier/payments': invoiceActions,
    '/supplier/messages': unread.size,
  };
}

// Latest message per thread, for the central inbox.
export interface ThreadSummary {
  order: SupplierOrderRow;
  latest: OrderMessage;
  unread: boolean;
  hasAttachment: boolean;
}

export async function fetchThreads(profileId: string): Promise<ThreadSummary[]> {
  const supabase = createClient();
  const [orders, unread, { data: msgs }] = await Promise.all([
    fetchSupplierOrders(),
    fetchUnreadOrderIds(profileId, true),
    supabase.from('order_messages').select('*').order('created_at', { ascending: false }),
  ]);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const threads: ThreadSummary[] = [];
  const seen = new Set<string>();
  for (const m of (msgs ?? []) as OrderMessage[]) {
    if (seen.has(m.order_id)) continue;
    seen.add(m.order_id);
    const order = byId.get(m.order_id);
    if (!order) continue; // outside the visible phase
    threads.push({ order, latest: m, unread: unread.has(m.order_id), hasAttachment: !!m.attachment_url });
  }
  return threads;
}
