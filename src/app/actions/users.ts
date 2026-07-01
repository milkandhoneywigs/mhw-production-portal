'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';
import type { Role } from '@/lib/constants';

// Create a portal user — ADMIN ONLY. Uses the service client to create the auth
// user; the handle_new_user trigger creates the matching profile from metadata.
export async function createUser(formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const admin = await requireAdmin();
  const email = formData.get('email')?.toString().trim();
  const password = formData.get('password')?.toString();
  const full_name = formData.get('full_name')?.toString().trim() || '';
  const role = (formData.get('role')?.toString() as Role) || 'staff';
  const supplier_id = formData.get('supplier_id')?.toString() || null;

  if (!email || !password) return { error: 'Email and password are required.' };
  if (role === 'supplier' && !supplier_id) return { error: 'A supplier user must be linked to a supplier.' };

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, supplier_id: supplier_id ?? '' },
  });
  if (error) return { error: error.message };

  await logAudit({ actorId: admin.id, action: 'user.create', entityType: 'profile', entityId: data.user?.id, metadata: { email, role } });
  revalidatePath('/settings/users');
  return { ok: true };
}

// Change a user's role / supplier link — ADMIN ONLY.
export async function updateUserRole(userId: string, role: Role, supplier_id: string | null) {
  const admin = await requireAdmin();
  const svc = createServiceClient();
  const { error } = await svc.from('profiles').update({ role, supplier_id: role === 'supplier' ? supplier_id : null }).eq('id', userId);
  if (error) return { error: error.message };
  await logAudit({ actorId: admin.id, action: 'user.update_role', entityType: 'profile', entityId: userId, metadata: { role } });
  revalidatePath('/settings/users');
  return {};
}
