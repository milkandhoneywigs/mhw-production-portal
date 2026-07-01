import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { upsertProductMapping } from '@/app/actions/mappings';
import type { ProductMapping } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProductMappingsPage() {
  await requireStaff();
  const supabase = createClient();
  const { data } = await supabase.from('product_mappings').select('*').order('style_name');
  const mappings = (data ?? []) as ProductMapping[];

  return (
    <>
      <PageHeader title="Product Mapping" subtitle="Style name to supplier style code. Used to auto-fill orders." />

      <Section title="Add / update mapping">
        {/* Server action form: upsert by style_name. */}
        <form action={upsertProductMapping} className="card p-4 grid md:grid-cols-4 gap-3 items-end">
          <div><label className="label">Style name</label><input name="style_name" className="input" placeholder="e.g. ANEESHA" required /></div>
          <div><label className="label">Supplier code</label><input name="supplier_style_code" className="input" placeholder="e.g. N95" required /></div>
          <div><label className="label">Default density</label><input name="default_density" className="input" /></div>
          <div><label className="label">Default cap style</label><input name="default_cap_style" className="input" /></div>
          <div className="md:col-span-3"><label className="label">Notes</label><input name="notes" className="input" /></div>
          <button className="btn-primary" type="submit">Save mapping</button>
        </form>
      </Section>

      <Section title={`Mappings (${mappings.length})`}>
        {mappings.length === 0 ? <EmptyState>No mappings yet. Run the seed or add one above.</EmptyState> : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-sand/60 border-b border-beige"><tr>
                <th className="th">Style name</th><th className="th">Supplier code</th><th className="th">Density</th><th className="th">Cap style</th><th className="th">Hair type</th><th className="th">Active</th>
              </tr></thead>
              <tbody className="divide-y divide-beige">
                {mappings.map((m) => (
                  <tr key={m.id}>
                    <td className="td font-medium">{m.style_name}</td>
                    <td className="td">{m.supplier_style_code}</td>
                    <td className="td">{m.default_density ?? '-'}</td>
                    <td className="td">{m.default_cap_style ?? '-'}</td>
                    <td className="td">{m.default_hair_type ?? '-'}</td>
                    <td className="td">{m.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
