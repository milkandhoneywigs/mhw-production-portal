import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { workerStatusTone, statusTone, STATUS_LABEL, type AgentWorker, type AgentCommand } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

export default async function WorkersPage() {
  await requireAdmin();
  const sb = createClient();
  const [{ data: workers }, { data: recent }] = await Promise.all([
    sb.from('agent_workers').select('*').order('created_at'),
    sb.from('agent_commands').select('id,title,status,claimed_by_worker,created_at').not('claimed_by_worker', 'is', null).order('created_at', { ascending: false }).limit(20),
  ]);
  const W = (workers ?? []) as AgentWorker[];
  const R = (recent ?? []) as AgentCommand[];

  return (
    <>
      <PageHeader title="Workers" subtitle="Execution machines. The Mac Studio Agent Runner (built later) claims queued commands and writes results back." />

      <div className="card p-4 mb-6 ring-1 ring-honey/40 bg-honey/5 text-sm">
        The local <b>Mac Studio Agent Runner</b> is not built yet. This page will show its live status once it polls Supabase.
        Commands you send are safely queued in the meantime.
      </div>

      {W.length === 0 ? <EmptyState>No workers registered.</EmptyState> : (
        <div className="grid md:grid-cols-2 gap-4">
          {W.map((w) => (
            <div key={w.id} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{w.worker_name}</div>
                  <div className="text-xs text-muted">{w.machine_name} · {w.worker_type}</div>
                </div>
                <CCBadge tone={workerStatusTone(w.status)}>{w.status}</CCBadge>
              </div>
              <dl className="text-sm mt-3 space-y-1">
                <div className="flex justify-between"><span className="text-muted">Last seen</span><span>{w.last_seen_at ? new Date(w.last_seen_at).toLocaleString('en-AU') : 'never'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Current command</span><span>{w.current_command_id ?? '—'}</span></div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mt-8 mb-3">Recent claimed runs</h2>
      {R.length === 0 ? <EmptyState>No claimed runs yet.</EmptyState> : (
        <div className="card divide-y divide-beige">
          {R.map((c) => (
            <Link key={c.id} href={`/command-centre/commands/${c.id}`} className="p-3 flex items-center justify-between hover:bg-cream/60">
              <span className="text-sm">{c.title}</span><CCBadge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</CCBadge>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
