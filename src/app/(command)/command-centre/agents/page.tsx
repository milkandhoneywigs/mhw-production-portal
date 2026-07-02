import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { agentStatusTone, riskTone, type Agent, type OwnerApproval, type OwnerRisk } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  await requireAdmin();
  const sb = createClient();
  const [{ data: agents }, { data: approvals }, { data: risks }] = await Promise.all([
    sb.from('agents').select('*').order('created_at'),
    sb.from('owner_approvals').select('id,agent_id,status').eq('status', 'pending'),
    sb.from('owner_risks').select('id,agent_id,status').in('status', ['open', 'acknowledged']),
  ]);
  const A = (agents ?? []) as Agent[];
  const AP = (approvals ?? []) as Pick<OwnerApproval, 'id' | 'agent_id' | 'status'>[];
  const RK = (risks ?? []) as Pick<OwnerRisk, 'id' | 'agent_id' | 'status'>[];

  return (
    <>
      <PageHeader title="Agents" subtitle={`${A.filter((a) => a.status === 'active').length} active · ${A.length} total`} />
      <div className="grid md:grid-cols-2 gap-4">
        {A.map((a) => {
          const pend = AP.filter((x) => x.agent_id === a.id).length;
          const openR = RK.filter((x) => x.agent_id === a.id).length;
          return (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/command-centre/agents/${a.slug}`} className="font-medium hover:underline">{a.name}</Link>
                  <div className="text-xs text-muted">{a.business_area}</div>
                </div>
                <div className="flex gap-1"><CCBadge tone={agentStatusTone(a.status)}>{a.status}</CCBadge><CCBadge tone={riskTone(a.risk_level)}>{a.risk_level}</CCBadge></div>
              </div>
              {a.description && <p className="text-sm text-muted mt-2 line-clamp-2">{a.description}</p>}
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className={pend ? 'text-amber-700 font-medium' : 'text-muted'}>{pend} pending approval{pend === 1 ? '' : 's'}</span>
                <span className={openR ? 'text-red-600 font-medium' : 'text-muted'}>{openR} open risk{openR === 1 ? '' : 's'}</span>
                <div className="ml-auto flex gap-3">
                  <Link href={`/command-centre/agents/${a.slug}`} className="text-honey hover:underline">Open agent →</Link>
                  {a.module_link && <Link href={a.module_link} className="text-emerald-700 hover:underline">Module →</Link>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
