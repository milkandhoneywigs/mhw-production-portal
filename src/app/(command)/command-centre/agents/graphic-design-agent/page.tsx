import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { CommandComposer } from '@/components/command/CommandComposer';
import { ItemApproval } from '@/components/command/ItemApproval';
import { CompletedWork } from '@/components/command/CompletedWork';
import { AgentReport } from '@/components/command/AgentReport';
import { AgentConversations } from '@/components/command/AgentConversations';
import type { Agent } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Design Agent module — with a live DESIGN GALLERY: every deliverable renders
// visually inside the portal (sandboxed iframes), with approve/deny per design.
// -----------------------------------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  tokens: 'BRAND TOKENS', component: 'COMPONENT', email: 'EMAIL', banner: 'BANNER', page: 'PAGE', other: 'DESIGN',
};

export default async function DesignAgentModule() {
  await requireAdmin();
  const sb = createClient();

  const { data: agentRow } = await sb.from('agents').select('*').eq('slug', 'graphic-design-agent').single();
  const agent = agentRow as Agent | null;

  const [{ data: designs }, { data: updates }, { data: tools }] = await Promise.all([
    sb.from('design_deliverables').select('*').neq('status', 'archived').order('created_at'),
    agent ? sb.from('agent_updates').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
    agent ? sb.from('agent_tool_connections').select('*').eq('agent_id', agent.id).order('created_at') : Promise.resolve({ data: [] }),
  ]);
  const D = (designs ?? []) as any[];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Link href="/command-centre/agents" className="text-xs text-honey hover:underline">← Agents</Link>
        <h1 className="text-xl font-semibold">Design Agent — Brand · Creative · Email</h1>
        <CCBadge tone="good">{agent?.status ?? 'active'}</CCBadge>
        <CCBadge tone="warn">SUGGEST ONLY</CCBadge>
      </div>
      <p className="text-sm text-muted mb-6">
        Every design renders live below — approve the ones you want in use. Brand assets: local Dropbox mirror.
        Generation: Leonardo AI. PREMIUM and OUTLET never mix.
      </p>

      {agent && <AgentConversations agentId={agent.id} />}

      {/* THE GALLERY */}
      <Section title={`Design Gallery (${D.length})`}>
        {D.length === 0 ? <EmptyState>No designs yet — command the agent below and they appear here.</EmptyState> : (
          <div className="space-y-4">
            {D.map((d) => (
              <div key={d.id} className={`card overflow-hidden ${d.status === 'approved' || d.status === 'in_use' ? 'ring-1 ring-emerald-200' : 'ring-1 ring-honey/30'}`}>
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-beige bg-sand/40">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CCBadge tone="honey">{KIND_LABEL[d.kind] ?? d.kind}</CCBadge>
                    <span className="font-medium text-sm">{d.title}</span>
                    <CCBadge tone={d.status === 'approved' || d.status === 'in_use' ? 'good' : 'warn'}>{d.status === 'review' ? 'FOR REVIEW' : d.status.replace('_', ' ').toUpperCase()}</CCBadge>
                    {d.description && <span className="text-xs text-muted">{d.description}</span>}
                  </div>
                  {d.status === 'review' && <ItemApproval table="design_deliverables" id={d.id} />}
                </div>
                <iframe
                  srcDoc={d.html}
                  sandbox=""
                  title={d.title}
                  className="w-full bg-white"
                  style={{ height: d.kind === 'email' ? 560 : 380, border: 0 }}
                />
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted mt-2">Approving marks a design ready for use (Klaviyo import, site use, ad creative). Nothing publishes automatically.</p>
      </Section>

      {/* Command */}
      <Section title="Command Design Agent">
        <div className="card p-5">
          {agent && <CommandComposer agents={[{ id: agent.id, name: 'Design Agent', status: agent.status }]}
            placeholder={'e.g. "Design a spring campaign banner set" · "Generate 4 hero image options for the NZ launch" · "Build the abandoned-cart email template"'} />}
        </div>
      </Section>

      {/* Reports */}
      <Section title="Reports From Your Agent">
        {(updates ?? []).length === 0 ? <EmptyState>No reports yet.</EmptyState> : (
          <div className="space-y-2">
            {(updates ?? []).map((u: any) => (
              <details key={u.id} className="card p-4">
                <summary className="cursor-pointer flex items-center gap-2 flex-wrap">
                  <CCBadge tone={u.update_type === 'error' ? 'danger' : 'good'}>{u.update_type === 'success' ? 'REPORT' : u.update_type}</CCBadge>
                  <span className="text-sm font-medium">{u.title}</span>
                  <span className="text-[11px] text-muted ml-auto">{new Date(u.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </summary>
                {u.summary && <div className="mt-3 border-t border-beige pt-3"><AgentReport text={u.summary} /></div>}
              </details>
            ))}
          </div>
        )}
      </Section>

      <CompletedWork agentId={agent?.id ?? null} />

      <Section title="Tool Connections">
        <div className="card p-4 space-y-1.5">
          {(tools ?? []).map((t: any) => (
            <div key={t.id}>
              <div className="flex items-center justify-between text-sm">
                <span>{t.tool_name}</span>
                <CCBadge tone={t.status === 'connected' ? 'good' : 'honey'}>{t.status}</CCBadge>
              </div>
              {t.notes && <p className="text-[10px] text-muted">{t.notes}</p>}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
