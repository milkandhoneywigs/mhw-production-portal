import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { ApprovalActions } from '@/components/command/ActionButtons';
import { priorityTone, money, MODULE_LABEL, APPROVAL_TYPE_LABEL, type OwnerApproval } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  await requireAdmin();
  const sb = createClient();
  const { data } = await sb.from('owner_approvals').select('*').order('status').order('created_at', { ascending: false });
  const AP = (data ?? []) as OwnerApproval[];
  const pending = AP.filter((a) => a.status === 'pending');
  const decided = AP.filter((a) => a.status !== 'pending');

  return (
    <>
      <PageHeader title="Approvals" subtitle={`Owner approval centre — ${pending.length} pending`} />

      {pending.length === 0 ? <EmptyState>Nothing awaiting approval.</EmptyState> : (
        <div className="space-y-3">
          {pending.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <CCBadge tone={priorityTone(a.priority)}>{a.priority}</CCBadge>
                  </div>
                  <div className="text-xs text-muted mt-0.5">{APPROVAL_TYPE_LABEL[a.approval_type]} · {MODULE_LABEL[a.source_module]}</div>
                  {a.description && <p className="text-sm mt-2">{a.description}</p>}
                  {a.financial_impact != null && <p className="text-sm mt-1 font-medium">Financial impact: {money(a.financial_impact, a.currency ?? 'AUD')}</p>}
                </div>
                <div className="w-64 shrink-0"><ApprovalActions id={a.id} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mt-8 mb-3">Decided</h2>
          <div className="card divide-y divide-beige">
            {decided.map((a) => (
              <div key={a.id} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0"><span className="text-sm">{a.title}</span>{a.decision_note && <span className="text-xs text-muted ml-2">— {a.decision_note}</span>}</div>
                <CCBadge tone={a.status === 'approved' ? 'good' : a.status === 'rejected' ? 'danger' : 'neutral'}>{a.status}</CCBadge>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
