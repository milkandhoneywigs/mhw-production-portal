'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { SupplierUpdateType, TrackingType } from '@/lib/types';

// All supplier actions go through the authenticated client, so RLS guarantees
// the supplier can only affect orders where orders.supplier_id = their supplier_id.
// Staff/admin can also call these (RLS allows staff full access).

async function orderSupplierId(supabase: ReturnType<typeof createClient>, orderId: string) {
  const { data } = await supabase.from('orders').select('supplier_id, order_type, shipping_destination').eq('id', orderId).single();
  return data;
}

export async function supplierAddUpdate(orderId: string, updateType: SupplierUpdateType, message: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  const ord = await orderSupplierId(supabase, orderId);
  const { error } = await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id ?? profile.supplier_id,
    update_type: updateType, message, created_by: profile.id,
  });
  if (error) return { error: error.message };
  await logAudit({ actorId: profile.id, action: 'supplier.update', entityType: 'order', entityId: orderId, metadata: { updateType } });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/supplier');
  return {};
}

// Supplier confirms the order. Records confirmation + timestamp and, for
// made-to-order, moves it past awaiting_supplier_confirmation.
export async function supplierConfirmOrder(orderId: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  const ord = await orderSupplierId(supabase, orderId);
  const nextStatus = ord?.order_type === 'ready_made' ? 'supplier_notified' : 'awaiting_supplier_confirmation';

  const { error } = await supabase.from('orders')
    .update({ supplier_confirmed_at: new Date().toISOString(), status: nextStatus })
    .eq('id', orderId);
  if (error) return { error: error.message };
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'confirmation',
    message: 'Order confirmed by supplier.', created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.confirm', entityType: 'order', entityId: orderId });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/supplier');
  return {};
}

// Payment terms live on the supplier row; 'deposit_50' preserves the original
// 50%-deposit behaviour, 'full_on_completion' invoices the full amount at the end.
async function paymentTermsFor(supabase: ReturnType<typeof createClient>, supplierId: string | null | undefined) {
  if (!supplierId) return 'deposit_50';
  const { data } = await supabase.from('suppliers').select('payment_terms').eq('id', supplierId).single();
  return (data?.payment_terms as string) ?? 'deposit_50';
}

export async function supplierMarkProductionComplete(orderId: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: ord } = await supabase.from('orders').select('supplier_id, supplier_price').eq('id', orderId).single();

  // PRODUCTION FINISHED -> auto-raise the remaining balance invoice for admin
  // (half under deposit_50 terms, the full price under full_on_completion).
  const terms = await paymentTermsFor(supabase, ord?.supplier_id);
  const price = ord?.supplier_price ? Number(ord.supplier_price) : null;
  const balance = price ? Math.round((terms === 'deposit_50' ? price / 2 : price) * 100) / 100 : null;
  const newStatus = balance ? 'balance_payment_required' : 'production_complete';

  const { error } = await supabase.from('orders')
    .update({ status: newStatus, production_complete_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return { error: error.message };

  if (balance) {
    await supabase.from('invoices').insert({
      order_id: orderId, supplier_id: ord?.supplier_id, invoice_type: 'balance',
      amount: balance, currency: 'AUD', status: 'payment_required',
      uploaded_by: profile.id, invoice_number: `BAL-${orderId.slice(0, 8)}`,
    });
  }
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'production_complete',
    message: balance ? `Production complete. Balance invoice ($${balance}) raised for payment.` : 'Production complete.',
    created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.production_complete', entityType: 'order', entityId: orderId, metadata: { balance } });
  revalidatePath(`/orders/${orderId}`); revalidatePath('/supplier'); revalidatePath('/billing');
  return {};
}

export async function supplierUploadTracking(
  orderId: string,
  data: { carrier: string; tracking_number: string; tracking_url?: string; tracking_type: TrackingType },
) {
  const profile = await requireProfile();
  const supabase = createClient();
  const ord = await orderSupplierId(supabase, orderId);

  const { error } = await supabase.from('tracking').insert({
    order_id: orderId, carrier: data.carrier, tracking_number: data.tracking_number,
    tracking_url: data.tracking_url ?? null, tracking_type: data.tracking_type, uploaded_by: profile.id,
  });
  if (error) return { error: error.message };

  // Ships direct to customer when ready-made OR an international made-to-order
  // (shipping_destination = customer_direct). Otherwise it heads to the showroom.
  const shipsToCustomer = ord?.order_type === 'ready_made' || ord?.shipping_destination === 'customer_direct';
  if (shipsToCustomer) {
    await supabase.from('orders').update({ status: 'tracking_uploaded' }).eq('id', orderId);
  } else {
    await supabase.from('orders').update({ status: 'shipped_to_showroom', shipped_to_showroom_at: new Date().toISOString() }).eq('id', orderId);
  }
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'tracking_uploaded',
    message: `Tracking uploaded: ${data.carrier} ${data.tracking_number}`, created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.tracking', entityType: 'order', entityId: orderId, metadata: { carrier: data.carrier } });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/supplier');
  return {};
}

// Supplier (or admin) adds the total price for an order.
// OWNER HARD RULE (2026-07-14):
//   ready_made  -> invoice for 100% of the price goes to the owner for payment.
//                  Order status is untouched (shipping flow continues in parallel).
//   made_to_order + deposit_50 -> 50% deposit invoice + payment gate (original flow).
//   made_to_order + full_on_completion -> price recorded; full invoice at completion.
// Pricing is admin/supplier only — staff cannot set prices.
export async function supplierSetPrice(orderId: string, totalPrice: number) {
  const profile = await requireProfile();
  if (profile.role === 'staff') return { error: 'Pricing is for admin and supplier only.' };
  if (!(totalPrice > 0)) return { error: 'Enter a valid price.' };
  const supabase = createClient();
  const ord = await orderSupplierId(supabase, orderId);
  const isReadyMade = ord?.order_type === 'ready_made';
  const terms = await paymentTermsFor(supabase, ord?.supplier_id);
  const withDeposit = !isReadyMade && terms === 'deposit_50';
  const invoiceAmount = isReadyMade ? totalPrice : Math.round((totalPrice / 2) * 100) / 100;

  const patch: Record<string, unknown> = { supplier_price: totalPrice };
  if (withDeposit) patch.status = 'payment_required';
  const { error: uErr } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (uErr) return { error: uErr.message };

  if (isReadyMade || withDeposit) {
    const { error } = await supabase.from('invoices').insert({
      order_id: orderId, supplier_id: ord?.supplier_id ?? profile.supplier_id,
      invoice_type: 'initial', amount: invoiceAmount, currency: 'AUD', status: 'payment_required',
      uploaded_by: profile.id,
      invoice_number: `${isReadyMade ? 'FULL' : 'DEP'}-${orderId.slice(0, 8)}`,
    });
    if (error) return { error: error.message };
  }

  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'invoice_uploaded',
    message: isReadyMade
      ? `Price added: $${totalPrice}. Full-payment invoice ($${invoiceAmount}) created for payment.`
      : withDeposit
        ? `Price added: $${totalPrice}. 50% deposit invoice ($${invoiceAmount}) created for payment.`
        : `Price added: $${totalPrice}.`,
    created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.set_price', entityType: 'order', entityId: orderId, metadata: { totalPrice, invoiceAmount: isReadyMade || withDeposit ? invoiceAmount : null, terms } });
  revalidatePath(`/orders/${orderId}`); revalidatePath('/supplier'); revalidatePath('/billing');
  return {};
}

// Supplier requests payment of their outstanding invoice(s). Surfaces as an
// order message (drives the owner's inbox bell) + timeline entry.
export async function supplierRequestPayment(orderId: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: ord } = await supabase.from('orders')
    .select('supplier_id, order_number, supplier_price').eq('id', orderId).single();
  if (!ord) return { error: 'Order not found.' };
  if (ord.supplier_price == null) return { error: 'Add the order price first.' };

  const { data: unpaid } = await supabase.from('invoices')
    .select('invoice_number, amount, status').eq('order_id', orderId)
    .in('status', ['uploaded', 'submitted', 'payment_required', 'approved', 'scheduled_for_payment']);
  const total = (unpaid ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const detail = total > 0 ? ` — $${total.toFixed(2)} AUD outstanding` : '';

  const { error } = await supabase.from('order_messages').insert({
    order_id: orderId, sender_id: profile.id,
    sender_name: profile.full_name || profile.email, sender_role: profile.role,
    body: `💰 PAYMENT REQUEST for order #${ord.order_number}${detail}. Please arrange payment.`,
  });
  if (error) return { error: error.message };
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord.supplier_id, update_type: 'general_note',
    message: `Payment requested by supplier${detail}.`, created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.request_payment', entityType: 'order', entityId: orderId, metadata: { total } });
  revalidatePath('/supplier'); revalidatePath('/billing'); revalidatePath(`/orders/${orderId}`);
  return {};
}

// Ready-made: order packed and ready for the DHL pickup/label step.
export async function supplierMarkReadyToDispatch(orderId: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  const ord = await orderSupplierId(supabase, orderId);
  const { error } = await supabase.from('orders')
    .update({ status: 'awaiting_dhl_tracking' })
    .eq('id', orderId).eq('status', 'supplier_notified');
  if (error) return { error: error.message };
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'general_note',
    message: 'Order packed and ready to dispatch.', created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.ready_to_dispatch', entityType: 'order', entityId: orderId });
  revalidatePath('/supplier');
  return {};
}

// Made-to-order: production has begun.
export async function supplierStartProduction(orderId: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  const ord = await orderSupplierId(supabase, orderId);
  const { error } = await supabase.from('orders')
    .update({ status: 'in_production', production_started_at: new Date().toISOString() })
    .eq('id', orderId).in('status', ['payment_paid', 'awaiting_supplier_confirmation', 'invoice_uploaded']);
  if (error) return { error: error.message };
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'production_update',
    message: 'Production started.', created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.start_production', entityType: 'order', entityId: orderId });
  revalidatePath('/supplier');
  return {};
}

// Structured delay report — required when an order is overdue.
export async function supplierReportDelay(
  orderId: string,
  data: { reason: string; revised_completion_date?: string; message?: string },
) {
  const profile = await requireProfile();
  if (!data.reason?.trim()) return { error: 'A reason for the delay is required.' };
  const supabase = createClient();
  const ord = await orderSupplierId(supabase, orderId);
  const { error } = await supabase.from('order_delays').insert({
    order_id: orderId, supplier_id: ord?.supplier_id ?? profile.supplier_id,
    reason: data.reason.trim(), revised_completion_date: data.revised_completion_date || null,
    message: data.message?.trim() || null, created_by: profile.id,
  });
  if (error) return { error: error.message };
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'delay_notice',
    message: `Delay reported: ${data.reason.trim()}${data.revised_completion_date ? ` — revised completion ${data.revised_completion_date}` : ''}`,
    created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.report_delay', entityType: 'order', entityId: orderId, metadata: data });
  revalidatePath('/supplier');
  return {};
}

// Register an uploaded storage file against the order (path in order-files bucket).
export async function registerOrderFile(orderId: string, fileType: string, path: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { error } = await supabase.from('files').insert({
    order_id: orderId, file_type: fileType, file_url: path, uploaded_by: profile.id,
  });
  if (error) return { error: error.message };
  await logAudit({ actorId: profile.id, action: 'file.upload', entityType: 'order', entityId: orderId, metadata: { fileType, path } });
  revalidatePath('/supplier');
  revalidatePath(`/orders/${orderId}`);
  return {};
}

// Bulk line item progress. restock_items has no supplier UPDATE policy, so this
// verifies ownership explicitly and then writes with the service client — the
// supplier can only ever change qty_completed/status on their own order's lines.
export async function supplierUpdateRestockItem(itemId: string, qtyCompleted: number, done: boolean) {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: item } = await supabase.from('restock_items').select('id, order_id, quantity').eq('id', itemId).single();
  if (!item) return { error: 'Line item not found.' }; // RLS: invisible unless owned or staff
  const qty = Math.max(0, Math.min(Number(qtyCompleted) || 0, item.quantity));

  const { createServiceClient } = await import('@/lib/supabase/service');
  const service = createServiceClient();
  const { error } = await service.from('restock_items')
    .update({ qty_completed: qty, status: done || qty >= item.quantity ? 'complete' : qty > 0 ? 'in_production' : 'pending' })
    .eq('id', itemId);
  if (error) return { error: error.message };
  await logAudit({ actorId: profile.id, action: 'supplier.restock_progress', entityType: 'order', entityId: item.order_id, metadata: { itemId, qty, done } });
  revalidatePath('/supplier');
  return {};
}
