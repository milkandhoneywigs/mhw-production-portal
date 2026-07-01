'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Post a message on an order's thread. Staff/admin and the assigned supplier can
// both post; RLS guarantees a supplier can only reach their own orders.
export async function postOrderMessage(orderId: string, body: string) {
  const text = (body || '').trim();
  if (!text) return { error: 'Message is empty.' };
  const profile = await requireProfile();
  const supabase = createClient();
  const { error } = await supabase.from('order_messages').insert({
    order_id: orderId,
    sender_id: profile.id,
    sender_name: profile.full_name || profile.email,
    sender_role: profile.role,
    body: text,
  });
  if (error) return { error: error.message };
  await logAudit({ actorId: profile.id, action: 'order.message', entityType: 'order', entityId: orderId });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/supplier');
  return {};
}
