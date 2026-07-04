import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { DemoCompleteButton } from '@/components/command/ActionButtons';
import { AgentReport } from '@/components/command/AgentReport';
import { statusTone, priorityTone, STATUS_LABEL, type AgentCommand, type Agent } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-beige/60 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="col-span-2 text-sm">{value || <span className="text-muted">—</span>}</dd>
    </div>
  );
}
const dt = (v: string | null) => (v ? new Date(v).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);

export default async function CommandDetail({ params }: { params: { id: string } }) {
  await requireAdmin();
  const sb = createClient();
  const { data: command } = await sb.from('agent_commands').select('*').eq('id', params.id).single();
  if (!command) notFound();
  const c = command as AgentCommand;

  const [{ data: agent }, { data: messages }, { data: results }, { data: logs }, { data: approvals }, { data: risks }, { data: tasks }] = await Promise.all([
    c.agent_id ? sb.from('agents').select('*').eq('id', c.agent_id).single() : Promise.resolve({ data: null }),
    sb.from('agent_command_messages').select('*').eq('command_id', c.id).order('created_at'),
    sb.from('agent_command_results').select('*').eq('command_id', c.id).order('created_at'),
    sb.from('agent_run_logs').select('*').eq('command_id', c.id).order('created_at'),
    sb.from('owner_approvals').select('id,title,status').eq('command_id', c.id),
    sb.from('owner_risks').select('id,title,risk_level').eq('command_id', c.id),
    sb.from('business_tasks').select('id,title,status').eq('command_id', c.id),
  ]);
  const ag = agent as Agent | null;
  const M = (messages ?? []) as { id: string; sender_type: string; message: string; created_at: string }[];
  const RS = (results ?? []) as { id: string; result_type: string; title: string | null; content: string | null; file_url: string | null }[];
  const LG = (logs ?? []) as { id: string; log_level: string; message: string; created_at: string }[];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link href="/command-centre/commands" className="text-xs text-honey hover:underline">← Commands</Link>
        <h1 className="text-xl font-semibold">{c.title ?? 'Command'}</h1>
        <CCBadge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</CCBadge>
        <CCBadge tone={priorityTone(c.priority)}>{c.priority}</CCBadge>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Original prompt</h2>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-ink/[0.03] rounded-lg p-3">{c.prompt}</pre>
          </div>

          {c.status === 'failed' && c.error_message && (
            <div className="card p-5 ring-1 ring-red-200">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700 mb-2">Error</h2>
              <p className="text-sm text-red-700">{c.error_message}</p>
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Results</h2>
            {RS.length === 0 ? <p className="text-sm text-muted">No results yet.</p> : RS.map((r) => (
              <div key={r.id} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 mb-1"><CCBadge tone="info">{r.result_type}</CCBadge><span className="text-sm font-medium">{r.title ?? 'Result'}</span></div>
                {r.content && <AgentReport text={r.content} />}
                {r.file_url && <a href={r.file_url} className="text-xs text-honey hover:underline">Open file →</a>}
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Message thread</h2>
            {M.length === 0 ? <p className="text-sm text-muted">No messages.</p> : (
              <div className="space-y-2">
                {M.map((m) => (
                  <div key={m.id} className="text-sm"><CCBadge tone={m.sender_type === 'owner' ? 'honey' : m.sender_type === 'agent' ? 'info' : 'neutral'}>{m.sender_type}</CCBadge> <span className="ml-2">{m.message}</span></div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Run logs</h2>
            {LG.length === 0 ? <p className="text-sm text-muted">No logs.</p> : (
              <pre className="text-xs font-mono text-ink/80 whitespace-pre-wrap">{LG.map((l) => `[${l.log_level}] ${dt(l.created_at)}  ${l.message}`).join('\n')}</pre>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Details</h2>
            <dl>
              <Row label="Agent" value={ag ? <Link href={`/command-centre/agents/${ag.slug}`} className="text-honey hover:underline">{ag.name}</Link> : '—'} />
              <Row label="Type" value={c.command_type} />
              <Row label="Priority" value={c.priority} />
              <Row label="Execution target" value={c.execution_target} />
              <Row label="Execution mode" value={c.execution_mode} />
              <Row label="Claimed worker" value={c.claimed_by_worker} />
              <Row label="Created" value={dt(c.created_at)} />
              <Row label="Started" value={dt(c.started_at)} />
              <Row label="Completed" value={dt(c.completed_at)} />
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Developer / admin</h2>
            <p className="text-xs text-muted mb-2">Simulate the Mac Studio runner completing this command (no local execution).</p>
            <DemoCompleteButton commandId={c.id} disabled={c.status === 'completed'} />
          </div>

          <Section title="Related">
            <div className="card p-4 text-sm space-y-1">
              <div className="text-xs text-muted uppercase tracking-wide">Approvals</div>
              {(approvals ?? []).length ? (approvals as any[]).map((a) => <div key={a.id}>{a.title} <CCBadge tone="warn">{a.status}</CCBadge></div>) : <div className="text-muted text-xs">none</div>}
              <div className="text-xs text-muted uppercase tracking-wide mt-2">Risks</div>
              {(risks ?? []).length ? (risks as any[]).map((r) => <div key={r.id}>{r.title} <CCBadge tone="danger">{r.risk_level}</CCBadge></div>) : <div className="text-muted text-xs">none</div>}
              <div className="text-xs text-muted uppercase tracking-wide mt-2">Tasks</div>
              {(tasks ?? []).length ? (tasks as any[]).map((t) => <div key={t.id}>{t.title} <CCBadge>{t.status}</CCBadge></div>) : <div className="text-muted text-xs">none</div>}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
