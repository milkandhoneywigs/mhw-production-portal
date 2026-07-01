'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { generateCustomerUpdateDraft } from '@/lib/business/customer-update';
import type { CustomerUpdateType } from '@/lib/types';
import type { Order, Customer } from '@/lib/types';

// Create a DRAFT customer update for a milestone. v1 never auto-sends.
export async function createCustomerUpdateDraft(orderId: string, type: CustomerUpdateType) {
  const profile = await requireStaff();
  const supabase = createClient();

  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (!order) return { error: 'Order not found.' };
  const { data: customer } = order.customer_id
    ? await supabase.from('customers').select('*').eq('id', order.customer_id).single()
    : { data: null };

  const draft = generateCustomerUpdateDraft(type, order as Order, customer as Customer | null);
  const { error } = await supabase.from('customer_updates').insert({
    order_id: orderId, update_type: draft.update_type, subject: draft.subject,
    message: draft.message, status: 'draft', created_by: profile.id,
  });
  if (error) return { error: error.message };
  await logAudit({ actorId: profile.id, action: 'customer_update.draft', entityType: 'order', entityId: orderId, metadata: { type } });
  revalidatePath('/customer-updates');
  revalidatePath(`/orders/${orderId}`);
  return {};
}

// Approve / mark sent / skip. "Sent" in v1 just records the human action + time;
// no email is dispatched. Editing the message is supported via `message`.
export async function setCustomerUpdateStatus(
  id: string, status: 'draft' | 'approved' | 'sent' | 'skipped', message?: string,
) {
  const profile = await requireStaff();
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (message !== undefined) patch.message = message;
  if (status === 'approved') patch.approved_by = profile.id;
  if (status === 'sent') { patch.sent_at = new Date().toISOString(); patch.approved_by = profile.id; }

  const { data: cu, error } = await supabase.from('customer_updates').update(patch).eq('id', id).select('order_id').single();
  if (error) return { error: error.message };

  // When a customer update is sent, stamp the order's last-update time.
  if (status === 'sent' && cu) {
    await supabase.from('orders').update({ last_customer_update_at: new Date().toISOString(), next_customer_update_due: null }).eq('id', cu.order_id);
  }
  await logAudit({ actorId: profile.id, action: `customer_update.${status}`, entityType: 'customer_update', entityId: id });
  revalidatePath('/customer-updates');
  return {};
}
