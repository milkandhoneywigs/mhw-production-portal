'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile, requireAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import type { InvoiceType, PaymentMethod } from '@/lib/types';

// Upload an invoice (admin OR supplier via RLS).
//   Supplier uploads  -> 'submitted' (awaiting M&H review; order status untouched).
//   Admin uploads     -> straight to 'payment_required' (their own approval is implied).
// Payments happen manually outside the portal; this only records status.
export async function uploadInvoice(
  orderId: string,
  data: { invoice_type: InvoiceType; invoice_number?: string; amount?: number; currency?: string; file_url?: string },
) {
  const profile = await requireProfile();
  if (profile.role === 'staff') return { error: 'Billing is for admin and supplier only.' };
  const supabase = createClient();
  const { data: ord } = await supabase.from('orders').select('supplier_id').eq('id', orderId).single();
  const isSupplier = profile.role === 'supplier';

  const { error } = await supabase.from('invoices').insert({
    order_id: orderId, supplier_id: ord?.supplier_id ?? profile.supplier_id,
    invoice_type: data.invoice_type, invoice_number: data.invoice_number ?? null,
    amount: data.amount ?? null, currency: data.currency ?? 'AUD',
    file_url: data.file_url ?? null, uploaded_by: profile.id,
    status: isSupplier ? 'submitted' : 'payment_required',
  });
  if (error) return { error: error.message };

  // Admin uploads gate the order immediately; supplier submissions gate on approval.
  if (!isSupplier) {
    const orderStatus = data.invoice_type === 'balance' ? 'balance_payment_required' : 'payment_required';
    await supabase.from('orders').update({ status: orderStatus }).eq('id', orderId);
  }
  await supabase.from('supplier_updates').insert({
    order_id: orderId, supplier_id: ord?.supplier_id, update_type: 'invoice_uploaded',
    message: isSupplier ? `Invoice submitted for approval (${data.invoice_type}).` : `Invoice uploaded (${data.invoice_type}).`,
    created_by: profile.id,
  });
  await logAudit({ actorId: profile.id, action: 'invoice.upload', entityType: 'order', entityId: orderId, metadata: { invoice_type: data.invoice_type, submitted: isSupplier } });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/billing');
  revalidatePath('/supplier');
  return {};
}

// Admin reviews a supplier-submitted invoice: approve (moves the order to its
// payment gate) or request changes (supplier sees the reason and resubmits).
export async function reviewInvoice(
  invoiceId: string,
  decision: 'approve' | 'changes',
  notes?: string,
) {
  const profile = await requireAdmin();
  const supabase = createClient();
  const { data: inv } = await supabase.from('invoices').select('order_id, invoice_type, status').eq('id', invoiceId).single();
  if (!inv) return { error: 'Invoice not found.' };
  if (inv.status !== 'submitted') return { error: 'Only submitted invoices can be reviewed.' };

  const { error } = await supabase.from('invoices').update({
    status: decision === 'approve' ? 'payment_required' : 'changes_requested',
    notes: notes?.trim() || null,
  }).eq('id', invoiceId);
  if (error) return { error: error.message };

  if (decision === 'approve') {
    const orderStatus = inv.invoice_type === 'balance' ? 'balance_payment_required' : 'payment_required';
    await supabase.from('orders').update({ status: orderStatus }).eq('id', inv.order_id);
  }
  await logAudit({ actorId: profile.id, action: `invoice.${decision === 'approve' ? 'approve' : 'request_changes'}`, entityType: 'invoice', entityId: invoiceId, metadata: { notes } });
  revalidatePath('/billing');
  revalidatePath('/supplier');
  revalidatePath(`/orders/${inv.order_id}`);
  return {};
}

// Mark an invoice paid — STAFF/ADMIN ONLY (suppliers can never mark paid).
// Records the manual payment reference; the actual transfer happened outside.
export async function markInvoicePaid(
  invoiceId: string,
  data: { payment_method: PaymentMethod; payment_reference?: string },
) {
  const profile = await requireAdmin();
  const supabase = createClient();

  const { data: inv, error: readErr } = await supabase
    .from('invoices').select('order_id, invoice_type').eq('id', invoiceId).single();
  if (readErr || !inv) return { error: 'Invoice not found.' };

  const { error } = await supabase.from('invoices').update({
    status: 'paid', payment_method: data.payment_method,
    payment_reference: data.payment_reference ?? null, paid_at: new Date().toISOString(),
  }).eq('id', invoiceId);
  if (error) return { error: error.message };

  // Advance the order past the payment gate.
  const nextStatus = inv.invoice_type === 'balance' ? 'balance_paid' : 'payment_paid';
  await supabase.from('orders').update({ status: nextStatus }).eq('id', inv.order_id);

  await logAudit({
    actorId: profile.id, action: 'invoice.mark_paid', entityType: 'invoice', entityId: invoiceId,
    metadata: { method: data.payment_method, reference: data.payment_reference },
  });
  revalidatePath('/billing');
  revalidatePath(`/orders/${inv.order_id}`);
  return {};
}
