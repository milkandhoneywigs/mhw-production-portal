import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';

// "What has been done" — a per-agent completed-work record so the owner never
// wonders. Aggregates completed commands, done tasks, success updates, plus any
// module-specific implemented items passed in by the page. Server component.

export interface DoneItem {
  kind: string;                // e.g. 'command' | 'task' | 'collection SEO' | 'schema'
  title: string;
  detail?: string | null;
  when: string | null;         // ISO timestamp
  href?: string;
}

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export async function CompletedWork({ agentId, extraItems = [], limit = 25 }: {
  agentId: string | null; extraItems?: DoneItem[]; limit?: number;
}) {
  const sb = createClient();
  const [{ data: cmds }, { data: tasks }, { data: updates }] = await Promise.all([
    agentId
      ? sb.from('agent_commands').select('id,title,prompt,result_summary,completed_at').eq('agent_id', agentId).eq('status', 'completed').order('completed_at', { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    agentId
      ? sb.from('business_tasks').select('id,title,description,updated_at').eq('agent_id', agentId).eq('status', 'done').order('updated_at', { ascending: false }).limit(limit)
      : Promise.resolve({ data: [] }),
    agentId
      ? sb.from('agent_updates').select('id,title,summary,update_type,created_at').eq('agent_id', agentId).in('update_type', ['success', 'info']).order('created_at', { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const items: DoneItem[] = [
    ...((cmds ?? []) as any[]).map((c) => ({
      kind: 'command', title: c.title ?? c.prompt?.slice(0, 70), detail: c.result_summary, when: c.completed_at,
      href: `/command-centre/commands/${c.id}`,
    })),
    ...((tasks ?? []) as any[]).map((t) => ({ kind: 'task', title: t.title, detail: t.description, when: t.updated_at })),
    ...((updates ?? []) as any[])
      .filter((u) => /completed|complete|done|implemented|published|fixed/i.test(`${u.title} ${u.summary ?? ''}`))
      .map((u) => ({ kind: 'run', title: u.title, detail: u.summary, when: u.created_at })),
    ...extraItems,
  ].filter((i) => i.when !== undefined)
   .sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''))
   .slice(0, limit);

  return (
    <Section title={`Completed Work (${items.length})`}>
      {items.length === 0 ? (
        <EmptyState>Nothing completed yet — finished commands, implemented approvals and closed tasks will appear here.</EmptyState>
      ) : (
        <div className="card divide-y divide-beige">
          {items.map((i, idx) => (
            <div key={idx} className="p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CCBadge tone="good">DONE</CCBadge>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{i.kind}</span>
                  {i.href
                    ? <Link href={i.href} className="text-sm font-medium hover:underline">{i.title}</Link>
                    : <span className="text-sm font-medium">{i.title}</span>}
                </div>
                {i.detail && <p className="text-xs text-muted mt-0.5 line-clamp-2">{i.detail}</p>}
              </div>
              <span className="text-xs text-muted whitespace-nowrap shrink-0">{fmt(i.when)}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
