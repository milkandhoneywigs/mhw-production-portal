import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { agentStatusTone, type Agent } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

// Plan actions are structured: {text, status: todo|in_progress|done}.
// % complete = done / total. The in_progress item is what the agent is working
// on right now; when everything is done the plan completes and the next
// objective begins.
interface PlanAction { text: string; status: 'todo' | 'in_progress' | 'done' }
interface Plan {
  id: string; agent_id: string | null; title: string; objective: string | null;
  current_focus: string | null; next_actions: PlanAction[] | string[]; status: string; updated_at: string;
}

const normalise = (a: PlanAction | string): PlanAction =>
  typeof a === 'string' ? { text: a, status: 'todo' } : a;

export default async function PlansPage() {
  await requireAdmin();
  const sb = createClient();
  const [{ data: plans }, { data: agents }] = await Promise.all([
    sb.from('agent_plans').select('*').order('updated_at', { ascending: false }),
    sb.from('agents').select('id,name,slug,status'),
  ]);
  const P = (plans ?? []) as unknown as Plan[];
  const A = (agents ?? []) as Pick<Agent, 'id' | 'name' | 'slug' | 'status'>[];
  const agentOf = (id: string | null) => A.find((a) => a.id === id);

  const active = P.filter((p) => p.status === 'active');
  const completed = P.filter((p) => p.status === 'completed');

  return (
    <>
      <PageHeader title="Plans" subtitle="Every active agent's objective, live progress, and the task in-flight right now. Complete one objective → straight onto the next." />

      {active.length === 0 ? <EmptyState>No active plans.</EmptyState> : (
        <div className="grid md:grid-cols-2 gap-4">
          {active.map((p) => {
            const actions = (p.next_actions ?? []).map(normalise);
            const done = actions.filter((a) => a.status === 'done').length;
            const pct = actions.length ? Math.round((done / actions.length) * 100) : 0;
            const current = actions.find((a) => a.status === 'in_progress') ?? actions.find((a) => a.status === 'todo');
            const ag = agentOf(p.agent_id);
            return (
              <div key={p.id} className="card p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    {ag ? <Link href={`/command-centre/agents/${ag.slug}`} className="text-sm font-semibold hover:underline">{ag.name}</Link> : <span className="text-sm font-semibold">—</span>}
                    <div className="text-xs text-muted">{p.title}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ag && <CCBadge tone={agentStatusTone(ag.status)}>{ag.status}</CCBadge>}
                    <span className="text-lg font-semibold tabular-nums text-honey">{pct}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 rounded-full bg-beige overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-honey/70 to-honey transition-all" style={{ width: `${Math.max(pct, 3)}%` }} />
                </div>
                <div className="text-[11px] text-muted mt-1">{done} of {actions.length} actions complete</div>

                {/* Working on now */}
                {current && (
                  <div className="mt-3 rounded-lg bg-honey/10 ring-1 ring-honey/30 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-honey font-semibold mb-0.5">Working on now</div>
                    <div className="text-sm font-medium">{current.text}</div>
                  </div>
                )}

                {/* Objective + action list */}
                {p.objective && <p className="text-xs text-muted mt-3"><b>Objective:</b> {p.objective}</p>}
                <ul className="mt-2 space-y-1">
                  {actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 w-3.5 h-3.5 rounded-full shrink-0 grid place-items-center text-[9px] ${
                        a.status === 'done' ? 'bg-emerald-500 text-white' : a.status === 'in_progress' ? 'bg-honey text-white' : 'bg-beige text-muted'}`}>
                        {a.status === 'done' ? '✓' : a.status === 'in_progress' ? '›' : ''}
                      </span>
                      <span className={a.status === 'done' ? 'line-through text-muted' : a.status === 'in_progress' ? 'font-medium' : 'text-ink/80'}>{a.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mt-8 mb-3">Completed objectives</h2>
          <div className="card divide-y divide-beige">
            {completed.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between">
                <div><span className="text-sm font-medium">{p.title}</span><span className="text-xs text-muted ml-2">{agentOf(p.agent_id)?.name}</span></div>
                <CCBadge tone="good">100% · COMPLETED</CCBadge>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
