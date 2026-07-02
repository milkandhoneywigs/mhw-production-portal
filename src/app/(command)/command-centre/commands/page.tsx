import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { statusTone, priorityTone, STATUS_LABEL, type Agent, type AgentCommand, type CommandStatus } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

const FILTERS: (CommandStatus | 'all')[] = ['all', 'queued', 'claimed', 'running', 'completed', 'failed', 'needs_approval', 'cancelled'];

export default async function CommandsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdmin();
  const sb = createClient();
  const status = (searchParams.status || 'all') as CommandStatus | 'all';

  let q = sb.from('agent_commands').select('*').order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') q = q.eq('status', status);
  const [{ data: commands }, { data: agents }] = await Promise.all([q, sb.from('agents').select('id,name')]);
  const C = (commands ?? []) as AgentCommand[];
  const A = (agents ?? []) as Pick<Agent, 'id' | 'name'>[];
  const agentName = (id: string | null) => A.find((a) => a.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader title="Commands" subtitle={`Command queue — ${C.length}${status !== 'all' ? ` ${STATUS_LABEL[status as CommandStatus]}` : ''}`}
        action={<Link href="/command-centre/terminal" className="btn-primary">New command</Link>} />

      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <Link key={f} href={f === 'all' ? '/command-centre/commands' : `/command-centre/commands?status=${f}`}
            className={`text-xs rounded-full px-3 py-1 ring-1 ${status === f ? 'bg-ink text-cream ring-ink' : 'bg-white ring-beige text-ink hover:bg-sand'}`}>
            {f === 'all' ? 'All' : STATUS_LABEL[f as CommandStatus]}
          </Link>
        ))}
      </div>

      {C.length === 0 ? <EmptyState>No commands in this view.</EmptyState> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr>
                <th className="th">Command</th><th className="th">Agent</th><th className="th">Type</th>
                <th className="th">Priority</th><th className="th">Target</th><th className="th">Status</th>
                <th className="th">Created</th><th className="th">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {C.map((c) => (
                <tr key={c.id} className="hover:bg-cream/60">
                  <td className="td font-medium"><Link href={`/command-centre/commands/${c.id}`} className="hover:underline">{c.title ?? c.prompt.slice(0, 50)}</Link></td>
                  <td className="td">{agentName(c.agent_id)}</td>
                  <td className="td text-xs">{c.command_type}</td>
                  <td className="td"><CCBadge tone={priorityTone(c.priority)}>{c.priority}</CCBadge></td>
                  <td className="td text-xs">{c.execution_target}</td>
                  <td className="td"><CCBadge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</CCBadge></td>
                  <td className="td text-xs text-muted whitespace-nowrap">{new Date(c.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="td text-xs text-muted max-w-xs truncate">{c.result_summary ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
