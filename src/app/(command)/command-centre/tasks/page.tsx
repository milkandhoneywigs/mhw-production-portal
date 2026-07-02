import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { priorityTone, MODULE_LABEL, type BusinessTask, type TaskStatus } from '@/lib/command-centre/cc';

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
  const { data } = await sb.from('business_tasks').select('*').order('created_at', { ascending: false });
  const T = (data ?? []) as BusinessTask[];

  return (
    <>
      <PageHeader title="Tasks" subtitle="Business action queue across all modules." />
      {T.length === 0 ? <EmptyState>No tasks yet.</EmptyState> : (
        <div className="grid md:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const items = T.filter((t) => t.status === col.status);
            return (
              <div key={col.status}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">{col.label} ({items.length})</h2>
                <div className="space-y-2">
                  {items.map((t) => (
                    <div key={t.id} className="card p-3">
                      <div className="flex items-center justify-between gap-2 mb-1"><CCBadge tone={priorityTone(t.priority)}>{t.priority}</CCBadge><span className="text-[10px] text-muted uppercase">{MODULE_LABEL[t.source_module]}</span></div>
                      <div className="text-sm font-medium">{t.title}</div>
                      {t.description && <p className="text-xs text-muted mt-1">{t.description}</p>}
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
