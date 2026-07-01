'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff, requireProfile } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { classifyOrder } from '@/lib/business/classify';
import { calculateSupplierLength } from '@/lib/business/length';
import type { OrderStatus } from '@/lib/constants';

// Manual order numbers: MH-YYYYMMDD-XXXX (staff can also type their own).
function generateOrderNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MH-${ymd}-${rand}`;
}

const s = (fd: FormData, k: string) => (fd.get(k)?.toString().trim() || null);

// -----------------------------------------------------------------------------
// Create a custom / manual order (staff). Applies the length + classification
// rules, auto-fills the supplier style code, and sets the correct status +
// shipping destination.
// -----------------------------------------------------------------------------
export async function createManualOrder(formData: FormData): Promise<{ error?: string }> {
  const profile = await requireStaff();
  const supabase = createClient();

  const requestedType = (s(formData, 'order_type') as 'ready_made' | 'made_to_order') || 'made_to_order';
  const styleName = s(formData, 'internal_style_name');
  const orderedLength = s(formData, 'customer_ordered_length');
  const supplierId = s(formData, 'supplier_id');

  if (!s(formData, 'customer_full_name')) return { error: 'Customer name is required.' };
  if (!styleName) return { error: 'Please select a style.' };

  // Look up the supplier style code from product_mappings (auto-fill).
  const { data: mapping } = await supabase
    .from('product_mappings')
    .select('supplier_style_code, default_cap_style, default_density, default_hair_type')
    .eq('style_name', styleName)
    .maybeSingle();

  // Classification + length. A manual override wins; otherwise apply the -2" rule.
  const classification = classifyOrder({ requestedType, customerOrderedLength: orderedLength });
  const overrideLen = s(formData, 'supplier_order_length');
  const lenResult = calculateSupplierLength(orderedLength);
  const supplierLength = overrideLen ?? lenResult.supplierLength;

  // CUSTOM COLOUR orders must be confirmed with the supplier before payment /
  // production — always flag them for manual review.
  const isCustomColour = (styleName || '').toUpperCase().includes('CUSTOM COLOUR')
    || (s(formData, 'colour_notes') || '').toUpperCase().includes('CUSTOM COLOUR');

  // If made-to-order and we could not derive a length and staff did not override,
  // keep it as needs_review so nobody guesses.
  const needsReview = isCustomColour || (requestedType === 'made_to_order' && !overrideLen && classification.needsReview);
  const orderType = needsReview ? 'needs_review' : classification.orderType;
  const status: OrderStatus = needsReview ? 'manager_review_required' : classification.status;

  // Create the customer row.
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .insert({
      full_name: s(formData, 'customer_full_name'),
      email: s(formData, 'customer_email'),
      phone: s(formData, 'customer_phone'),
      shipping_address_line1: s(formData, 'address_line1'),
      shipping_address_line2: s(formData, 'address_line2'),
      suburb: s(formData, 'suburb'),
      state: s(formData, 'state'),
      postcode: s(formData, 'postcode'),
      country: s(formData, 'country') ?? 'Australia',
    })
    .select('id')
    .single();
  if (custErr || !customer) return { error: `Could not save customer: ${custErr?.message}` };

  const orderNumber = s(formData, 'order_number') ?? generateOrderNumber();

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      // Channel picked on the form: online = website/Shopify bucket, in-store = manual bucket.
      source: s(formData, 'channel') === 'online' ? 'shopify' : 'manual',
      customer_id: customer.id,
      supplier_id: supplierId,
      order_type: orderType,
      status,
      assigned_staff_id: profile.id,
      customer_facing_product_name: s(formData, 'customer_facing_product_name') ?? styleName,
      internal_style_name: styleName,
      supplier_style_code: mapping?.supplier_style_code ?? null,
      customer_ordered_length: orderedLength,
      supplier_order_length: supplierLength,
      cap_style: s(formData, 'cap_style') ?? mapping?.default_cap_style ?? null,
      cap_size: s(formData, 'cap_size'),
      density: s(formData, 'density') ?? mapping?.default_density ?? null,
      hair_type: s(formData, 'hair_type') ?? mapping?.default_hair_type ?? 'human hair',
      colour_notes: s(formData, 'colour_notes'),
      production_notes: s(formData, 'production_notes'),
      internal_notes: isCustomColour
        ? `CUSTOM COLOUR - confirm with supplier before payment/production. ${s(formData, 'internal_notes') ?? ''}`.trim()
        : s(formData, 'internal_notes'),
      risk_level: isCustomColour ? 'high' : 'low',
      shipping_destination: classification.shippingDestination,
    })
    .select('id')
    .single();
  if (orderErr || !order) return { error: `Could not create order: ${orderErr?.message}` };

  await logAudit({
    actorId: profile.id, action: 'order.create', entityType: 'order', entityId: order.id,
    metadata: { order_number: orderNumber, order_type: orderType, needs_review: needsReview },
  });

  revalidatePath('/orders');
  redirect(`/orders/${order.id}`);
}

// Generic status change (staff). Records via the DB status-history trigger.
export async function setOrderStatus(orderId: string, newStatus: OrderStatus, note?: string) {
  const profile = await requireStaff();
  const supabase = createClient();

  // Stamp the relevant lifecycle timestamp for common transitions.
  const patch: Record<string, unknown> = { status: newStatus };
  const nowIso = new Date().toISOString();
  if (newStatus === 'in_production') patch.production_started_at = nowIso;
  if (newStatus === 'production_complete') patch.production_complete_at = nowIso;
  if (newStatus === 'arrived_at_showroom') patch.arrived_at_showroom_at = nowIso;
  if (newStatus === 'qc_passed') patch.qc_completed_at = nowIso;
  if (newStatus === 'dispatched_to_customer') patch.dispatched_to_customer_at = nowIso;
  if (newStatus === 'completed') patch.completed_at = nowIso;
  if (newStatus === 'supplier_notified') patch.date_sent_to_supplier = nowIso;

  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) return { error: error.message };

  if (note) {
    await supabase.from('order_status_history').insert({
      order_id: orderId, new_status: newStatus, changed_by: profile.id, note,
    });
  }
  await logAudit({ actorId: profile.id, action: 'order.status', entityType: 'order', entityId: orderId, metadata: { newStatus } });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
  return {};
}

// Save internal / production notes and key production fields (staff).
export async function saveOrderFields(orderId: string, formData: FormData) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { error } = await supabase.from('orders').update({
    production_notes: s(formData, 'production_notes'),
    internal_notes: s(formData, 'internal_notes'),
    expected_completion_date: s(formData, 'expected_completion_date'),
    supplier_order_length: s(formData, 'supplier_order_length'),
    supplier_id: s(formData, 'supplier_id'),
  }).eq('id', orderId);
  if (error) return { error: error.message };
  await logAudit({ actorId: profile.id, action: 'order.update', entityType: 'order', entityId: orderId });
  revalidatePath(`/orders/${orderId}`);
  return {};
}

// Delete an order (staff/admin). Cascades history/updates/invoices/tracking/qc/files.
export async function deleteOrder(orderId: string) {
  const profile = await requireStaff();
  const supabase = createClient();
  const { data: ord } = await supabase.from('orders').select('order_number').eq('id', orderId).single();
  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) return { error: error.message };
  await logAudit({
    actorId: profile.id, action: 'order.delete', entityType: 'order', entityId: orderId,
    metadata: { order_number: ord?.order_number },
  });
  revalidatePath('/orders');
  redirect('/orders');
}
