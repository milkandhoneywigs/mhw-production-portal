import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { TaskQuickAdd, TaskActions } from '@/components/command/TaskBoard';
import { priorityTone, MODULE_LABEL, type BusinessTask, type TaskStatus, type Agent } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'done', label: 'Done' },
];

export default async function TasksPage() {
  await requireAdmin();
  const sb = createClient();
  const [{ data }, { data: agents }] = await Promise.all([
    sb.from('business_tasks').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(200),
    sb.from('agents').select('id,name').order('created_at'),
  ]);
  const T = (data ?? []) as BusinessTask[];
  const A = (agents ?? []) as Pick<Agent, 'id' | 'name'>[];
  const agentName = (id: string | null) => A.find((a) => a.id === id)?.name;

  return (
    <>
      <PageHeader title="Tasks" subtitle="Business action queue across all modules — owner + agent work items." />
      <TaskQuickAdd agents={A} />
      <div className="grid md:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = T.filter((t) => t.status === col.status);
          return (
            <div key={col.status}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{col.label} ({items.length})</h2>
              <div className="space-y-2">
                {items.map((t) => (
                  <div key={t.id} className="card p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <CCBadge tone={priorityTone(t.priority)}>{t.priority}</CCBadge>
                      <span className="text-[10px] text-muted uppercase">{MODULE_LABEL[t.source_module]}</span>
                    </div>
                    <div className="text-sm font-medium">{t.title}</div>
                    {t.description && <p className="text-xs text-muted mt-1">{t.description}</p>}
                    {agentName(t.agent_id) && <p className="text-[11px] text-honey mt-1">{agentName(t.agent_id)}</p>}
                    <TaskActions id={t.id} status={t.status} />
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-muted">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
