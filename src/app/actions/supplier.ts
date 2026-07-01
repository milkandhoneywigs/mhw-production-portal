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
  const { data } = await supabase.from('orders').select('supplier_id, order_type').eq('id', orderId).single();
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

export async function supplierMarkProductionComplete(orderId: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  const ord = await orderSupplierId(supabase, orderId);
  const { error } = await supabase.from('orders')
    .update({ status: 'production_complete', production_complete_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return { error: error.message };
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'production_complete',
    message: 'Production marked complete by supplier.', created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'supplier.production_complete', entityType: 'order', entityId: orderId });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/supplier');
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

  // Ready made: tracking uploaded advances the ready-made flow.
  if (ord?.order_type === 'ready_made') {
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
