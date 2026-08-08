'use server';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';

export type VenuePatch = {
  stage?: string;
  contacted?: boolean;
  assigned_to?: string | null;
  notes?: string | null;
  registered_for_launch?: boolean;
  signed_on?: boolean;
  device?: string | null;
};

export async function updateVenue(id: string, patch: VenuePatch) {
  const profile = await requireAdmin();
  const svc = createServiceClient();

  const row: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString(), updated_by: profile.full_name || profile.email };
  if (patch.contacted === true) row.contacted_at = new Date().toISOString();
  if (patch.contacted === false) row.contacted_at = null;
  if (patch.signed_on === true) row.signed_on_at = new Date().toISOString();
  if (patch.signed_on === false) { row.signed_on_at = null; row.device = null; }

  const { error } = await svc.from('waava_venues').update(row).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/command-centre/waava/prospecting');
  return { ok: true };
}
