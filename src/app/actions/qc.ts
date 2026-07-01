'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Submit a QC check (staff). If every check passes -> qc_passed. Otherwise the
// order goes to manager_review_required.
export async function submitQc(orderId: string, formData: FormData) {
  const profile = await requireStaff();
  const supabase = createClient();

  const b = (k: string) => formData.get(k) === 'on' || formData.get(k) === 'true';
  const checks = {
    correct_style: b('correct_style'),
    correct_colour: b('correct_colour'),
    correct_length: b('correct_length'),
    correct_cap_size: b('correct_cap_size'),
    correct_density: b('correct_density'),
    lace_checked: b('lace_checked'),
    no_visible_faults: b('no_visible_faults'),
  };
  const passed = Object.values(checks).every(Boolean);
  const qcStatus = passed ? 'passed' : 'failed';

  const { error } = await supabase.from('qc_checks').insert({
    order_id: orderId, checked_by: profile.id, ...checks,
    notes: formData.get('notes')?.toString() || null, status: qcStatus,
  });
  if (error) return { error: error.message };

  // Passed -> qc_passed; failed -> manager_review_required.
  const orderStatus = passed ? 'qc_passed' : 'manager_review_required';
  await supabase.from('orders').update({ status: orderStatus, qc_completed_at: new Date().toISOString() }).eq('id', orderId);

  await logAudit({ actorId: profile.id, action: 'qc.submit', entityType: 'order', entityId: orderId, metadata: { passed } });
  revalidatePath('/qc');
  revalidatePath(`/orders/${orderId}`);
  return { passed };
}
