'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Post a message on an order's thread. Staff/admin and the assigned supplier can
// both post; RLS guarantees a supplier can only reach their own orders.
// attachment = a path in the private order-files bucket (uploaded client-side).
export async function postOrderMessage(
  orderId: string,
  body: string,
  attachment?: { path: string; name: string },
) {
  const text = (body || '').trim();
  if (!text && !attachment) return { error: 'Message is empty.' };
  const profile = await requireProfile();
  const supabase = createClient();
  const { error } = await supabase.from('order_messages').insert({
    order_id: orderId,
    sender_id: profile.id,
    sender_name: profile.full_name || profile.email,
    sender_role: profile.role,
    body: text || attachment?.name || '',
    attachment_url: attachment?.path ?? null,
    attachment_name: attachment?.name ?? null,
  });
  if (error) return { error: error.message };
  await logAudit({ actorId: profile.id, action: 'order.message', entityType: 'order', entityId: orderId });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/supplier');
  return {};
}

// Record that the current user has read an order's thread (drives unread badges).
export async function markThreadRead(orderId: string) {
  const profile = await requireProfile();
  const supabase = createClient();
  await supabase.from('order_message_reads').upsert({
    profile_id: profile.id, order_id: orderId, last_read_at: new Date().toISOString(),
  });
  return {};
}
