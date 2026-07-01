import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CreateUserForm } from '@/components/admin/CreateUserForm';
import type { Profile, Supplier } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function UsersSettingsPage() {
  await requireAdmin();
  const supabase = createClient();
  const [{ data: profiles }, { data: suppliers }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*').order('name'),
  ]);
  const users = (profiles ?? []) as Profile[];
  const supplierList = (suppliers ?? []) as Supplier[];
  const supplierName = (id: string | null) => supplierList.find((s) => s.id === id)?.name ?? '-';

  return (
    <>
      <PageHeader title="Users & Settings" subtitle="Admin only. Create and manage portal accounts." />

      <Section title="Create a user">
        <CreateUserForm suppliers={supplierList} />
      </Section>

      <Section title={`Users (${users.length})`}>
        {users.length === 0 ? <EmptyState>No users yet.</EmptyState> : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-sand/60 border-b border-beige"><tr>
                <th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Supplier</th>
              </tr></thead>
              <tbody className="divide-y divide-beige">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="td font-medium">{u.full_name || '-'}</td>
                    <td className="td">{u.email}</td>
                    <td className="td"><span className="chip bg-sand text-ink ring-beige uppercase">{u.role}</span></td>
                    <td className="td">{u.role === 'supplier' ? supplierName(u.supplier_id) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Suppliers">
        {supplierList.length === 0 ? <EmptyState>No suppliers yet. Add them in Supabase or via a future admin form.</EmptyState> : (
          <div className="card p-4">
            <ul className="text-sm divide-y divide-beige">
              {supplierList.map((s) => (
                <li key={s.id} className="flex justify-between py-1.5">
                  <span>{s.name}{s.contact_name ? ` — ${s.contact_name}` : ''}</span>
                  <span className="text-muted">{s.active ? 'Active' : 'Inactive'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  );
}
