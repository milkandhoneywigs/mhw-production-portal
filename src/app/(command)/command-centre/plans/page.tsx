import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import type { Agent } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

interface Plan { id: string; agent_id: string | null; title: string; objective: string | null; current_focus: string | null; next_actions: string[]; status: string }

export default async function PlansPage() {
  await requireAdmin();
  const sb = createClient();
  const [{ data: plans }, { data: agents }] = await Promise.all([
    sb.from('agent_plans').select('*').order('updated_at', { ascending: false }),
    sb.from('agents').select('id,name'),
  ]);
  const P = (plans ?? []) as unknown as Plan[];
  const A = (agents ?? []) as Pick<Agent, 'id' | 'name'>[];
  const agentName = (id: string | null) => A.find((a) => a.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader title="Plans" subtitle="Each agent's current objective, focus and next actions." />
      {P.length === 0 ? <EmptyState>No agent plans yet.</EmptyState> : (
        <div className="space-y-4">
          {P.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div><span className="font-medium">{p.title}</span><span className="text-xs text-muted ml-2">{agentName(p.agent_id)}</span></div>
                <CCBadge tone={p.status === 'active' ? 'good' : p.status === 'paused' ? 'warn' : 'neutral'}>{p.status}</CCBadge>
              </div>
              {p.objective && <p className="text-sm mt-2"><span className="text-muted">Objective:</span> {p.objective}</p>}
              {p.current_focus && <p className="text-sm mt-1"><span className="text-muted">Current focus:</span> {p.current_focus}</p>}
              {Array.isArray(p.next_actions) && p.next_actions.length > 0 && (
                <ul className="text-sm mt-2 list-disc pl-5 space-y-0.5">
                  {p.next_actions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
