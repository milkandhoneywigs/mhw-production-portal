import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { AgentReport } from '@/components/command/AgentReport';
import { CommandReply } from '@/components/command/CommandReply';
import { AutoRefresh } from '@/components/command/AutoRefresh';
import { statusTone, STATUS_LABEL } from '@/lib/command-centre/cc';

// -----------------------------------------------------------------------------
// The agent's working surface: every recent command rendered as a CONVERSATION —
// your ask, the agent's answer, the thread, and a reply box. Work happens here,
// not in a report archive. Server component; pairs with AutoRefresh.
// -----------------------------------------------------------------------------

const dt = (v: string | null) =>
  v ? new Date(v).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export async function AgentConversations({ agentId, limit = 5 }: { agentId: string; limit?: number }) {
  const sb = createClient();
  const { data: cmds } = await sb.from('agent_commands')
    .select('id,title,prompt,status,created_at,started_at,completed_at')
    .eq('agent_id', agentId).order('created_at', { ascending: false }).limit(limit);
  const ids = (cmds ?? []).map((c) => c.id);
  const [{ data: results }, { data: messages }] = await Promise.all([
    ids.length ? sb.from('agent_command_results').select('command_id,title,content,created_at').in('command_id', ids).order('created_at') : Promise.resolve({ data: [] }),
    ids.length ? sb.from('agent_command_messages').select('command_id,sender_type,message,created_at').in('command_id', ids).order('created_at') : Promise.resolve({ data: [] }),
  ]);

  return (
    <Section title="Conversations — work with your agent here">
      <AutoRefresh seconds={20} />
      {(cmds ?? []).length === 0 ? (
        <EmptyState>No conversations yet — send the first command below.</EmptyState>
      ) : (
        <div className="space-y-4">
          {(cmds ?? []).map((c: any) => {
            // One thread = your ask + everything that came back, in time order.
            type Ev = { at: string; kind: 'you' | 'agent' | 'system'; body: string; isReport?: boolean };
            const events: Ev[] = [
              { at: c.created_at, kind: 'you', body: c.prompt ?? c.title ?? '' } as Ev,
              ...(results ?? []).filter((r: any) => r.command_id === c.id)
                .map((r: any) => ({ at: r.created_at, kind: 'agent' as const, body: r.content ?? '', isReport: true })),
              ...(messages ?? []).filter((m: any) => m.command_id === c.id && m.sender_type !== 'worker')
                .map((m: any): Ev => ({
                  at: m.created_at,
                  kind: m.sender_type === 'owner' ? 'you' : m.sender_type === 'agent' ? 'agent' : 'system',
                  body: m.message ?? '',
                })),
            ].sort((a, b) => a.at.localeCompare(b.at));
            const busy = ['queued', 'claimed', 'running'].includes(c.status);
            return (
              <details key={c.id} open={busy || (cmds ?? [])[0]?.id === c.id} className="card overflow-hidden">
                <summary className="cursor-pointer flex items-center gap-2 flex-wrap px-4 py-3 bg-sand/40 border-b border-beige">
                  {busy && <span className="w-2 h-2 rounded-full bg-honey animate-pulse shrink-0" />}
                  <span className="text-sm font-medium">{(c.title ?? '').slice(0, 90)}</span>
                  <CCBadge tone={statusTone(c.status)}>{(STATUS_LABEL as Record<string, string>)[c.status] ?? c.status}</CCBadge>
                  <span className="text-[11px] text-muted ml-auto">{dt(c.created_at)}</span>
                  <Link href={`/command-centre/commands/${c.id}`} className="text-[11px] text-honey hover:underline">full page →</Link>
                </summary>
                <div className="p-4 space-y-3">
                  {events.map((e, i) => (
                    e.kind === 'you' ? (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-honey/15 px-4 py-2.5">
                          <div className="text-[10px] font-semibold text-honey mb-0.5">YOU · {dt(e.at)}</div>
                          <div className="text-sm whitespace-pre-wrap">{e.body.length > 700 ? e.body.slice(0, 700) + '…' : e.body}</div>
                        </div>
                      </div>
                    ) : e.kind === 'agent' ? (
                      <div key={i} className="flex">
                        <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-sand/60 px-4 py-2.5 min-w-0">
                          <div className="text-[10px] font-semibold text-ink/60 mb-1">AGENT · {dt(e.at)}</div>
                          {e.isReport ? <AgentReport text={e.body} /> : <div className="text-sm whitespace-pre-wrap">{e.body}</div>}
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="text-center text-[11px] text-muted">{e.body}</div>
                    )
                  ))}
                  <CommandReply commandId={c.id} status={c.status} />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </Section>
  );
}
