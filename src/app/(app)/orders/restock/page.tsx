import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { RestockOrderForm } from '@/components/order/RestockOrderForm';
import type { ProductMapping } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RestockOrderPage() {
  await requireStaff();
  const supabase = createClient();
  const { data: mappings } = await supabase
    .from('product_mappings').select('*').eq('active', true).order('style_name');

  return (
    <>
      <PageHeader title="Store Restock Order" subtitle="Bulk order to restock a showroom. Supplier prices the sheet once it's submitted." />
      <RestockOrderForm mappings={(mappings ?? []) as ProductMapping[]} />
    </>
  );
}
