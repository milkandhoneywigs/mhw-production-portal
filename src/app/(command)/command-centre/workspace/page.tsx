import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { ApprovalActions } from '@/components/command/ActionButtons';
import { ItemApproval } from '@/components/command/ItemApproval';
import { AutoRefresh } from '@/components/command/AutoRefresh';
import { CommandComposer } from '@/components/command/CommandComposer';
import { statusTone, STATUS_LABEL, type Agent, type AgentCommand, type OwnerApproval } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// WORKSPACE — the live working surface. One screen that always answers:
// what is happening NOW · what NEEDS ME · what is each agent doing NEXT ·
// what got DONE today. Auto-refreshes; every item is actionable in place.
// -----------------------------------------------------------------------------

const ago = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};

type ModuleAsk = { table: string; id: string; label: string; title: string; detail: string | null; href: string };

export default async function Workspace() {
  await requireAdmin();
  const sb = createClient();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [
    { data: agents }, { data: active }, { data: doneToday }, { data: approvals }, { data: plans },
    { data: seoOpt }, { data: seoCol }, { data: seoSchema }, { data: seoProd },
    { data: mktCro }, { data: mktBudget }, { data: mktEmail }, { data: mktCreative },
    { data: designs }, { data: updatesToday },
  ] = await Promise.all([
    sb.from('agents').select('*').eq('status', 'active').order('created_at'),
    sb.from('agent_commands').select('id,title,agent_id,status,priority,created_at,started_at').in('status', ['running', 'claimed', 'queued']).order('created_at'),
    sb.from('agent_commands').select('id,title,agent_id,completed_at,result_summary').eq('status', 'completed').gte('completed_at', todayIso).order('completed_at', { ascending: false }).limit(12),
    sb.from('owner_approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    sb.from('agent_plans').select('agent_id,title,status,next_actions').eq('status', 'active'),
    sb.from('seo_optimisation_opportunities').select('id,title,description').eq('status', 'needs_approval'),
    sb.from('seo_collection_opportunities').select('id,collection_name').eq('approval_status', 'needs_approval'),
    sb.from('seo_schema_opportunities').select('id,page_url,schema_type').eq('approval_status', 'needs_approval'),
    sb.from('seo_product_page_opportunities').select('id,product_name').eq('status', 'needs_approval'),
    sb.from('mkt_cro_opportunities').select('id,title,suggested_fix').eq('approval_status', 'needs_approval'),
    sb.from('mkt_budget_recommendations').select('id,title,rationale').eq('status', 'needs_approval'),
    sb.from('mkt_email_opportunities').select('id,title,description').eq('status', 'needs_approval'),
    sb.from('mkt_creative_requests').select('id,title,angle').eq('status', 'needs_approval'),
    sb.from('design_deliverables').select('id,title,description').eq('status', 'review'),
    sb.from('agent_updates').select('id,agent_id,title,update_type,created_at').gte('created_at', todayIso).order('created_at', { ascending: false }).limit(10),
  ]);

  const A = (agents ?? []) as Agent[];
  const name = (id: string | null) => A.find((a) => a.id === id)?.name ?? 'Agent';
  const slug = (id: string | null) => A.find((a) => a.id === id)?.slug ?? '';
  const ACT = (active ?? []) as AgentCommand[];
  const AP = (approvals ?? []) as OwnerApproval[];

  const moduleAsks: ModuleAsk[] = [
    ...(seoOpt ?? []).map((r: any) => ({ table: 'seo_optimisation_opportunities', id: r.id, label: 'SEO', title: r.title, detail: r.description, href: '/command-centre/agents/seo-agent' })),
    ...(seoCol ?? []).map((r: any) => ({ table: 'seo_collection_opportunities', id: r.id, label: 'SEO · collection', title: r.collection_name, detail: null, href: '/command-centre/agents/seo-agent' })),
    ...(seoSchema ?? []).map((r: any) => ({ table: 'seo_schema_opportunities', id: r.id, label: 'SEO · schema', title: `${r.schema_type} — ${r.page_url}`, detail: null, href: '/command-centre/agents/seo-agent' })),
    ...(seoProd ?? []).map((r: any) => ({ table: 'seo_product_page_opportunities', id: r.id, label: 'SEO · product', title: r.product_name, detail: null, href: '/command-centre/agents/seo-agent' })),
    ...(mktCro ?? []).map((r: any) => ({ table: 'mkt_cro_opportunities', id: r.id, label: 'Marketing · CRO', title: r.title, detail: r.suggested_fix, href: '/command-centre/agents/marketing-agent' })),
    ...(mktBudget ?? []).map((r: any) => ({ table: 'mkt_budget_recommendations', id: r.id, label: 'Marketing · budget', title: r.title, detail: r.rationale, href: '/command-centre/agents/marketing-agent' })),
    ...(mktEmail ?? []).map((r: any) => ({ table: 'mkt_email_opportunities', id: r.id, label: 'Marketing · email', title: r.title, detail: r.description, href: '/command-centre/agents/marketing-agent' })),
    ...(mktCreative ?? []).map((r: any) => ({ table: 'mkt_creative_requests', id: r.id, label: 'Marketing · creative', title: r.title, detail: r.angle, href: '/command-centre/agents/marketing-agent' })),
    ...(designs ?? []).map((r: any) => ({ table: 'design_deliverables', id: r.id, label: 'Design', title: r.title, detail: r.description, href: '/command-centre/agents/graphic-design-agent' })),
  ];
  const needsYouCount = AP.length + moduleAsks.length;

  const running = ACT.filter((c) => c.status === 'running' || c.status === 'claimed');
  const queued = ACT.filter((c) => c.status === 'queued');

  return (
    <>
      <AutoRefresh seconds={20} />
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-xl font-semibold">Workspace</h1>
        <CCBadge tone={running.length ? 'honey' : 'neutral'}>{running.length} working</CCBadge>
        <CCBadge tone={needsYouCount ? 'warn' : 'good'}>{needsYouCount} need you</CCBadge>
        <span className="text-[11px] text-muted ml-auto">live · refreshes every 20s</span>
      </div>
      <p className="text-sm text-muted mb-6">Your working surface — what's happening, what needs you, what's next. Act on anything in place.</p>

      {/* ── NOW ─────────────────────────────────────────────────────────── */}
      <Section title="Happening Now">
        {ACT.length === 0 ? <EmptyState>All quiet — every agent is idle. Send a command below.</EmptyState> : (
          <div className="space-y-2">
            {running.map((c) => (
              <Link key={c.id} href={`/command-centre/commands/${c.id}`} className="card p-3.5 flex items-center gap-3 hover:shadow-md transition block">
                <span className="w-2.5 h-2.5 rounded-full bg-honey animate-pulse shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.title}</div>
                  <div className="text-[11px] text-muted">{name(c.agent_id)} · working {ago(c.started_at ?? c.created_at)}</div>
                </div>
                <CCBadge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</CCBadge>
              </Link>
            ))}
            {queued.map((c) => (
              <Link key={c.id} href={`/command-centre/commands/${c.id}`} className="card p-3 flex items-center gap-3 opacity-75 hover:opacity-100 hover:shadow-md transition block">
                <span className="w-2.5 h-2.5 rounded-full bg-beige shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{c.title}</div>
                  <div className="text-[11px] text-muted">{name(c.agent_id)} · queued {ago(c.created_at)} ago</div>
                </div>
                <CCBadge tone="neutral">NEXT UP</CCBadge>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* ── NEEDS YOU ───────────────────────────────────────────────────── */}
      <Section title={`Needs You (${needsYouCount})`}>
        {needsYouCount === 0 ? <EmptyState>Nothing waiting on you. 🎉</EmptyState> : (
          <div className="space-y-2">
            {AP.map((a) => (
              <div key={a.id} className="card p-4 ring-1 ring-amber-200">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CCBadge tone="warn">{name(a.agent_id)}</CCBadge>
                      <span className="text-sm font-medium">{a.title}</span>
                    </div>
                    {a.description && <p className="text-xs text-muted mt-1">{a.description}</p>}
                    {(a as any).command_id && (
                      <Link href={`/command-centre/commands/${(a as any).command_id}`} className="text-xs text-honey hover:underline">Open thread to discuss →</Link>
                    )}
                  </div>
                  <ApprovalActions id={a.id} />
                </div>
              </div>
            ))}
            {moduleAsks.map((m) => (
              <div key={`${m.table}-${m.id}`} className="card p-4 ring-1 ring-honey/40">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CCBadge tone="honey">{m.label}</CCBadge>
                      <span className="text-sm font-medium">{m.title}</span>
                    </div>
                    {m.detail && <p className="text-xs text-muted mt-1 line-clamp-2">{m.detail}</p>}
                    <Link href={m.href} className="text-xs text-honey hover:underline">Full specifics →</Link>
                  </div>
                  <ItemApproval table={m.table} id={m.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── UP NEXT (one line per agent) ───────────────────────────────── */}
      <Section title="Each Agent — Working On / Up Next">
        <div className="card divide-y divide-beige">
          {A.map((a) => {
            const plan = (plans ?? []).find((p: any) => p.agent_id === a.id) as any;
            const actions: any[] = Array.isArray(plan?.next_actions) ? plan.next_actions : [];
            const nowAction = actions.find((x) => (typeof x === 'object' ? x.status === 'in_progress' : false));
            const nextAction = actions.find((x) => (typeof x === 'object' ? x.status === 'todo' : false));
            const doneN = actions.filter((x) => typeof x === 'object' && x.status === 'done').length;
            const pct = actions.length ? Math.round((doneN / actions.length) * 100) : 0;
            const isWorking = running.some((c) => c.agent_id === a.id);
            return (
              <div key={a.id} className="p-3.5 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isWorking ? 'bg-honey animate-pulse' : 'bg-emerald-400'}`} />
                <Link href={`/command-centre/agents/${a.slug}`} className="text-sm font-medium w-44 shrink-0 truncate hover:text-honey">{a.name}</Link>
                <div className="min-w-0 flex-1 text-xs">
                  <span className="text-ink/90">{nowAction ? `▸ ${nowAction.text}` : plan ? plan.title : 'No active plan'}</span>
                  {nextAction && <span className="text-muted"> · then: {nextAction.text}</span>}
                </div>
                {plan && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-1.5 rounded-full bg-beige overflow-hidden"><div className="h-full bg-honey" style={{ width: `${pct}%` }} /></div>
                    <span className="text-[10px] text-muted tabular-nums">{pct}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── DONE TODAY ─────────────────────────────────────────────────── */}
      <Section title={`Done Today (${(doneToday ?? []).length})`}>
        {(doneToday ?? []).length === 0 ? <EmptyState>Nothing completed yet today.</EmptyState> : (
          <div className="card divide-y divide-beige">
            {(doneToday ?? []).map((c: any) => (
              <Link key={c.id} href={`/command-centre/commands/${c.id}`} className="p-3 flex items-center gap-3 hover:bg-cream/60 block">
                <span className="text-emerald-600 text-sm shrink-0">✓</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{c.title}</div>
                  <div className="text-[11px] text-muted truncate">{name(c.agent_id)} · {ago(c.completed_at)} ago · {(c.result_summary ?? '').slice(0, 90)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* ── COMMAND ────────────────────────────────────────────────────── */}
      <Section title="Send Work">
        <div className="card p-5">
          <CommandComposer agents={A.map((a) => ({ id: a.id, name: a.name, status: a.status }))}
            placeholder="Give any agent its next job — it starts within 15 seconds and shows up above." />
        </div>
      </Section>
    </>
  );
}
