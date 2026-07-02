import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CommandComposer } from '@/components/command/CommandComposer';
import { CCBadge } from '@/components/command/CCBadge';
import { statusTone, STATUS_LABEL, type Agent, type AgentCommand } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

export default async function TerminalPage() {
  await requireAdmin();
  const sb = createClient();
  const [{ data: agents }, { data: commands }, { data: results }] = await Promise.all([
    sb.from('agents').select('*').order('created_at'),
    sb.from('agent_commands').select('id,title,agent_id,status,priority,created_at,result_summary').order('created_at', { ascending: false }).limit(15),
    sb.from('agent_command_results').select('id,command_id,title,content,result_type,created_at').order('created_at', { ascending: false }).limit(5),
  ]);
  const A = (agents ?? []) as Agent[];
  const C = (commands ?? []) as AgentCommand[];
  const R = (results ?? []) as { id: string; command_id: string; title: string | null; content: string | null; result_type: string; created_at: string }[];

  return (
    <>
      <PageHeader title="Terminal" subtitle="Command your agents remotely — a safe, structured version of Claude Code." />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Composer */}
        <div className="lg:col-span-2">
          <div className="card p-5 bg-ink/[0.02]">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-3 h-3 rounded-full bg-red-400" /><span className="w-3 h-3 rounded-full bg-amber-400" /><span className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs text-muted ml-2 font-mono">owner@beyond-reason ~ command</span>
            </div>
            <CommandComposer agents={A.map((a) => ({ id: a.id, name: a.name, status: a.status }))}
              placeholder="Type an instruction for the selected agent… e.g. 'Analyse this month's cashflow risk and list what needs my approval.'" />
          </div>

          {/* Recent outputs */}
          <Section title="Recent Outputs">
            {R.length === 0 ? <EmptyState>No results yet. Queue a command, then use “Mark demo completed” on its detail page.</EmptyState> : (
              <div className="space-y-3">
                {R.map((r) => (
                  <Link key={r.id} href={`/command-centre/commands/${r.command_id}`} className="card p-4 block hover:shadow-md transition">
                    <div className="flex items-center gap-2 mb-1"><CCBadge tone="info">{r.result_type}</CCBadge><span className="text-sm font-medium">{r.title ?? 'Result'}</span></div>
                    <pre className="text-xs text-ink/80 whitespace-pre-wrap font-mono line-clamp-4">{r.content}</pre>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* History */}
        <div>
          <Section title="Command History" action={<Link href="/command-centre/commands" className="text-xs text-honey hover:underline">All →</Link>}>
            {C.length === 0 ? <EmptyState>No commands yet.</EmptyState> : (
              <div className="card divide-y divide-beige">
                {C.map((c) => (
                  <Link key={c.id} href={`/command-centre/commands/${c.id}`} className="p-3 block hover:bg-cream/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{c.title ?? c.prompt?.slice(0, 40)}</span>
                      <CCBadge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</CCBadge>
                    </div>
                    <div className="text-xs text-muted mt-0.5">{new Date(c.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
