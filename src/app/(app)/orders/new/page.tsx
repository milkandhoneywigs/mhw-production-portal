import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { NewOrderForm } from '@/components/order/NewOrderForm';
import type { ProductMapping, Supplier } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const profile = await requireStaff();
  const isAdmin = profile.role === 'admin'; // supplier assignment is admin-only
  const supabase = createClient();
  const [{ data: mappings }, { data: suppliers }] = await Promise.all([
    supabase.from('product_mappings').select('*').eq('active', true).order('style_name'),
    isAdmin ? supabase.from('suppliers').select('*').eq('active', true).order('name') : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <PageHeader title="Add Custom / Manual Order" subtitle="For in-store, custom, or staff-entered orders." />
      <NewOrderForm mappings={(mappings ?? []) as ProductMapping[]} suppliers={(suppliers ?? []) as Supplier[]} isAdmin={isAdmin} />
    </>
  );
}
