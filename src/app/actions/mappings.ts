'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// Add or update a style -> supplier code mapping (staff/admin).
export async function upsertProductMapping(formData: FormData): Promise<{ error?: string }> {
  const profile = await requireStaff();
  const supabase = createClient();
  const style_name = formData.get('style_name')?.toString().trim().toUpperCase();
  const supplier_style_code = formData.get('supplier_style_code')?.toString().trim();
  if (!style_name || !supplier_style_code) return { error: 'Style name and supplier code are required.' };

  const { error } = await supabase.from('product_mappings').upsert({
    style_name,
    supplier_style_code,
    default_cap_style: formData.get('default_cap_style')?.toString() || null,
    default_density: formData.get('default_density')?.toString() || null,
    default_hair_type: formData.get('default_hair_type')?.toString() || 'human hair',
    notes: formData.get('notes')?.toString() || null,
    active: true,
  }, { onConflict: 'style_name' });
  if (error) return { error: error.message };

  await logAudit({ actorId: profile.id, action: 'mapping.upsert', entityType: 'product_mapping', metadata: { style_name } });
  revalidatePath('/product-mappings');
  return {};
}
