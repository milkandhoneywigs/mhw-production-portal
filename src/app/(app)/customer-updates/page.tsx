import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { NewDraftForm, CustomerUpdateRow } from '@/components/customer/CustomerUpdateWidgets';
import type { CustomerUpdate } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Row = CustomerUpdate & { order?: { order_number: string } | null };

export default async function CustomerUpdatesPage() {
  await requireStaff();
  const supabase = createClient();
  const [{ data: updates }, { data: orders }] = await Promise.all([
    supabase.from('customer_updates').select('*, order:orders(order_number)').order('created_at', { ascending: false }),
    supabase.from('orders').select('id, order_number').neq('status', 'completed').order('created_at', { ascending: false }).limit(200),
  ]);
  const rows = (updates ?? []) as Row[];
  const pending = rows.filter((r) => r.status === 'draft' || r.status === 'approved');
  const done = rows.filter((r) => r.status === 'sent' || r.status === 'skipped');

  return (
    <>
      <PageHeader title="Customer Update Queue" subtitle="Draft, approve and record customer updates. Nothing is auto-sent in v1." />

      <Section title="Create a draft">
        <NewDraftForm orders={(orders ?? []) as { id: string; order_number: string }[]} />
      </Section>

      <Section title={`Pending review (${pending.length})`}>
        {pending.length === 0 ? <EmptyState>No drafts awaiting review.</EmptyState> : (
          <div className="grid md:grid-cols-2 gap-4">
            {pending.map((u) => <CustomerUpdateRow key={u.id} u={u} orderNumber={u.order?.order_number ?? '-'} />)}
          </div>
        )}
      </Section>

      <Section title="Recently actioned">
        {done.length === 0 ? <EmptyState>Nothing sent or skipped yet.</EmptyState> : (
          <div className="grid md:grid-cols-2 gap-4">
            {done.slice(0, 20).map((u) => <CustomerUpdateRow key={u.id} u={u} orderNumber={u.order?.order_number ?? '-'} />)}
          </div>
        )}
      </Section>
    </>
  );
}
