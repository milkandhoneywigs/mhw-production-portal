import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { CommandComposer } from '@/components/command/CommandComposer';
import { ApprovalActions, RiskActions } from '@/components/command/ActionButtons';
import { priorityTone, riskTone, money, type Agent, type OwnerApproval, type OwnerRisk } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// SEO Agent — the SEO + GEO growth module. Owner-only. Suggest-only posture:
// auto-publish DISABLED; anything customer-facing (titles, descriptions, URLs,
// redirects, schema, blogs) requires owner approval. Product titles/descriptions
// are a hard never.
// -----------------------------------------------------------------------------

type Tone = 'good' | 'honey' | 'danger' | 'warn' | 'neutral' | 'info';
const prio = (p: string) => priorityTone(p as any);
const statusToneOf = (s: string): Tone =>
  s === 'completed' || s === 'implemented' || s === 'published' || s === 'strong' ? 'good'
  : s === 'in_progress' || s === 'approved' || s === 'reviewing' ? 'info'
  : s === 'needs_approval' ? 'warn'
  : s === 'dismissed' ? 'neutral'
  : s === 'missing' || s === 'error' ? 'danger'
  : s === 'thin' || s === 'warning' ? 'warn'
  : 'honey';
const visTone = (v: string): Tone => (v === 'high' ? 'good' : v === 'medium' ? 'honey' : v === 'low' ? 'warn' : 'danger');

export default async function SeoAgentModule() {
  await requireAdmin();
  const sb = createClient();

  const { data: agentRow } = await sb.from('agents').select('*').eq('slug', 'seo-agent').single();
  const agent = agentRow as Agent | null;

  const [
    { data: keywords }, { data: geo }, { data: products }, { data: collections },
    { data: content }, { data: schema }, { data: opts }, { data: perf }, { data: rules },
    { data: caps }, { data: tools }, { data: approvals }, { data: risks }, { data: updates },
  ] = await Promise.all([
    sb.from('seo_keyword_opportunities').select('*').neq('status', 'dismissed').order('priority').order('created_at'),
    sb.from('seo_geo_opportunities').select('*').neq('approval_status', 'dismissed').order('priority'),
    sb.from('seo_product_page_opportunities').select('*').neq('status', 'dismissed').order('priority'),
    sb.from('seo_collection_opportunities').select('*').neq('approval_status', 'dismissed').order('priority'),
    sb.from('seo_content_plan').select('*').neq('status', 'dismissed').order('priority'),
    sb.from('seo_schema_opportunities').select('*').neq('approval_status', 'dismissed').order('priority'),
    sb.from('seo_optimisation_opportunities').select('*').neq('status', 'dismissed').order('priority').order('created_at'),
    sb.from('seo_performance_metrics').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('seo_agent_rules').select('*').eq('active', true).order('rule_type'),
    agent ? sb.from('agent_capabilities').select('*').eq('agent_id', agent.id).order('created_at') : Promise.resolve({ data: [] }),
    agent ? sb.from('agent_tool_connections').select('*').eq('agent_id', agent.id).order('created_at') : Promise.resolve({ data: [] }),
    agent ? sb.from('owner_approvals').select('*').eq('agent_id', agent.id).eq('status', 'pending') : Promise.resolve({ data: [] }),
    agent ? sb.from('owner_risks').select('*').eq('agent_id', agent.id).in('status', ['open', 'acknowledged']) : Promise.resolve({ data: [] }),
    agent ? sb.from('agent_updates').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
  ]);

  const KW = (keywords ?? []) as any[];
  const GEO = (geo ?? []) as any[];
  const PR = (products ?? []) as any[];
  const CO = (collections ?? []) as any[];
  const CT = (content ?? []) as any[];
  const SC = (schema ?? []) as any[];
  const OP = (opts ?? []) as any[];
  const P = perf as any;
  const AP = (approvals ?? []) as OwnerApproval[];
  const RK = (risks ?? []) as OwnerRisk[];
  const lastRun = (updates ?? [])[0] as any;
  const needsApproval =
    OP.filter((o) => o.status === 'needs_approval').length +
    CO.filter((c) => c.approval_status === 'needs_approval').length +
    SC.filter((s) => s.approval_status === 'needs_approval').length +
    PR.filter((p) => p.status === 'needs_approval').length;

  const Pill = CCBadge;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Link href="/command-centre/agents" className="text-xs text-honey hover:underline">← Agents</Link>
        <h1 className="text-xl font-semibold">SEO Agent — SEO + GEO Growth</h1>
        <Pill tone="good">{agent?.status ?? 'active'}</Pill>
        <Pill tone="warn">SUGGEST ONLY</Pill>
        <Pill tone="danger">AUTO-PUBLISH DISABLED</Pill>
      </div>
      <p className="text-sm text-muted mb-6">
        Analyses, recommends and drafts. Anything customer-facing (titles, descriptions, URLs, redirects, schema,
        blogs) requires your approval before it goes live. Product titles and descriptions are never edited.
      </p>

      {/* 1 — Overview */}
      <Section title="SEO Agent Overview">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-3"><div className="text-[11px] text-muted">Mode</div><div className="text-sm font-semibold mt-0.5">Suggest-only</div><div className="mt-1"><Pill tone="warn">APPROVAL REQUIRED</Pill></div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Last run</div><div className="text-sm font-semibold mt-0.5">{lastRun ? new Date(lastRun.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'awaiting first report'}</div><div className="text-[11px] text-muted mt-1">daily 7am on the Mac Studio</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Items needing approval</div><div className={`text-xl font-semibold tabular-nums ${needsApproval ? 'text-amber-700' : ''}`}>{needsApproval}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Open SEO risks</div><div className={`text-xl font-semibold tabular-nums ${RK.length ? 'text-red-600' : ''}`}>{RK.length}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Optimisation opportunities</div><div className="text-xl font-semibold tabular-nums text-honey">{OP.length}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Keyword gaps tracked</div><div className="text-xl font-semibold tabular-nums">{KW.length}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">GEO opportunities</div><div className="text-xl font-semibold tabular-nums">{GEO.length}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Content drafts / ideas</div><div className="text-xl font-semibold tabular-nums">{CT.length}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Organic revenue (90d)</div><div className="text-xl font-semibold tabular-nums text-emerald-700">{P?.organic_revenue ? money(P.organic_revenue) : '—'}</div><div className="text-[11px] text-muted">GA4 — organic is the #1 channel</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Visibility trend</div><div className="text-sm font-semibold mt-0.5">[DATA NEEDED]</div><div className="text-[11px] text-muted">populates from daily Semrush runs</div></div>
        </div>
      </Section>

      {/* 2 — Command */}
      <Section title="Command SEO Agent">
        <div className="card p-5">
          {agent && <CommandComposer agents={[{ id: agent.id, name: 'SEO Agent', status: agent.status }]}
            placeholder={'e.g. "Find keyword gaps from Semrush for human hair wigs." · "Check which product pages are missing meta descriptions." · "Build a blog plan for the next 30 days."'} />}
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 3 — Needs approval */}
        <Section title="Needs Approval">
          {AP.length === 0 && needsApproval === 0 ? <EmptyState>No SEO approvals pending.</EmptyState> : (
            <div className="space-y-3">
              {AP.map((a) => (
                <div key={a.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{a.title}</span><Pill tone={prio(a.priority)}>{a.priority}</Pill></div>
                  {a.description && <p className="text-xs text-muted mb-2">{a.description}</p>}
                  <ApprovalActions id={a.id} />
                </div>
              ))}
              {needsApproval > 0 && (
                <p className="text-xs text-muted">{needsApproval} drafted item(s) below are marked NEEDS APPROVAL — review them in their sections.</p>
              )}
            </div>
          )}
        </Section>

        {/* 4 — Open risks */}
        <Section title="Open SEO Risks">
          {RK.length === 0 ? <EmptyState>No open SEO risks.</EmptyState> : (
            <div className="space-y-3">
              {RK.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-1"><Pill tone={riskTone(r.risk_level)}>{r.risk_level} risk</Pill><span className="font-medium text-sm">{r.title}</span></div>
                  {r.description && <p className="text-xs text-muted mb-2">{r.description}</p>}
                  <RiskActions id={r.id} />
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* 5 — Semrush insights */}
      <Section title="Semrush Insights — Keyword Opportunities">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Keyword</th><th className="th">Vol</th><th className="th">Pos</th><th className="th">Intent</th><th className="th">Type</th><th className="th">Priority</th><th className="th">Status</th><th className="th">Notes</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {KW.map((k) => (
                <tr key={k.id} className="hover:bg-cream/60">
                  <td className="td font-medium">{k.keyword}</td>
                  <td className="td tabular-nums text-xs">{k.search_volume?.toLocaleString('en-AU') ?? '—'}</td>
                  <td className="td tabular-nums text-xs">{k.current_position ?? '—'}</td>
                  <td className="td text-xs">{k.intent}</td>
                  <td className="td"><Pill tone="info">{k.opportunity_type}</Pill></td>
                  <td className="td"><Pill tone={prio(k.priority)}>{k.priority}</Pill></td>
                  <td className="td"><Pill tone={statusToneOf(k.status)}>{k.status.replace('_', ' ')}</Pill></td>
                  <td className="td text-[11px] text-muted max-w-sm">{k.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted mt-2">Figures marked REAL come from the Semrush/GSC baselines pulled by the daily SEO agent; others populate on the next Semrush import.</p>
      </Section>

      {/* 6 — GEO */}
      <Section title="GEO — AI Search Visibility">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Question</th><th className="th">Target page</th><th className="th">Visibility</th><th className="th">Schema</th><th className="th">Priority</th><th className="th">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {GEO.map((g) => (
                <tr key={g.id} className="hover:bg-cream/60">
                  <td className="td font-medium text-sm max-w-xs">{g.question}</td>
                  <td className="td text-xs">{g.target_page ?? '—'}</td>
                  <td className="td"><Pill tone={visTone(g.current_visibility)}>{g.current_visibility}</Pill></td>
                  <td className="td text-[11px] text-muted">{g.schema_recommendation}</td>
                  <td className="td"><Pill tone={prio(g.priority)}>{g.priority}</Pill></td>
                  <td className="td"><Pill tone={statusToneOf(g.approval_status)}>{g.approval_status.replace('_', ' ')}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted mt-2">GEO = visibility in ChatGPT / Google AI Overviews / Perplexity / Copilot answers. Measured via Profound drops; content goes live only after your approval.</p>
      </Section>

      {/* 7 + 8 — Product & Collection SEO */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Product Page SEO">
          <div className="space-y-2">
            {PR.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{p.product_name}</span>
                  <Pill tone={statusToneOf(p.current_product_description_status)}>{p.current_product_description_status}</Pill>
                  <Pill tone={prio(p.priority)}>{p.priority}</Pill>
                  <Pill tone={statusToneOf(p.status)}>{p.status.replace('_', ' ')}</Pill>
                </div>
                {p.target_keyword && <p className="text-[11px] text-honey mt-1">Target: {p.target_keyword}</p>}
                {p.suggested_title && <p className="text-xs mt-1"><span className="text-muted">Suggested title:</span> {p.suggested_title}</p>}
                {p.schema_recommendations && <p className="text-[11px] text-muted mt-0.5">{p.schema_recommendations}</p>}
              </div>
            ))}
            <p className="text-[11px] text-muted">Titles/descriptions are drafted only — the agent never edits Shopify products.</p>
          </div>
        </Section>

        <Section title="Collection Page SEO">
          <div className="space-y-2">
            {CO.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{c.collection_name}</span>
                  <Pill tone={statusToneOf(c.current_description_status)}>{c.current_description_status} content</Pill>
                  <Pill tone={prio(c.priority)}>{c.priority}</Pill>
                  <Pill tone={statusToneOf(c.approval_status)}>{c.approval_status.replace('_', ' ')}</Pill>
                </div>
                {c.target_keywords && <p className="text-[11px] text-honey mt-1">Targets: {(c.target_keywords as string[]).join(' · ')}</p>}
                {c.faq_suggestions && <p className="text-[11px] text-muted mt-0.5">{c.faq_suggestions}</p>}
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* 9 — Content plan */}
      <Section title="Content / Blog Plan">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Suggested title</th><th className="th">Target keyword</th><th className="th">Funnel</th><th className="th">Priority</th><th className="th">Status</th><th className="th">GEO question answered</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {CT.map((c) => (
                <tr key={c.id} className="hover:bg-cream/60">
                  <td className="td font-medium text-sm">{c.suggested_title}</td>
                  <td className="td text-xs">{c.target_keyword}</td>
                  <td className="td text-xs capitalize">{c.funnel_stage}</td>
                  <td className="td"><Pill tone={prio(c.priority)}>{c.priority}</Pill></td>
                  <td className="td"><Pill tone={statusToneOf(c.status)}>{c.status.replace('_', ' ')}</Pill></td>
                  <td className="td text-[11px] text-muted max-w-xs">{c.geo_questions_answered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 10 — Schema */}
      <Section title="Schema / Rich Results">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Page</th><th className="th">Schema</th><th className="th">Status</th><th className="th">Issue / recommendation</th><th className="th">Priority</th><th className="th">Approval</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {SC.map((s) => (
                <tr key={s.id} className="hover:bg-cream/60">
                  <td className="td font-mono text-xs">{s.page_url}</td>
                  <td className="td"><Pill tone="info">{s.schema_type}</Pill></td>
                  <td className="td"><Pill tone={statusToneOf(s.current_status)}>{s.current_status}</Pill></td>
                  <td className="td text-xs text-muted max-w-md">{s.issue_description}{s.recommendation ? ` → ${s.recommendation}` : ''}</td>
                  <td className="td"><Pill tone={prio(s.priority)}>{s.priority}</Pill></td>
                  <td className="td"><Pill tone={statusToneOf(s.approval_status)}>{s.approval_status.replace('_', ' ')}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 11 — Main opportunities */}
      <Section title="SEO Optimisation Opportunities">
        <div className="space-y-2">
          {OP.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill tone="honey">{o.opportunity_type.replace('_', ' ')}</Pill>
                <span className="font-medium text-sm">{o.title}</span>
                <Pill tone={prio(o.priority)}>{o.priority}</Pill>
                <Pill tone={o.estimated_impact === 'high' ? 'good' : 'neutral'}>impact: {o.estimated_impact}</Pill>
                <Pill tone="neutral">effort: {o.effort}</Pill>
                {o.approval_required && <Pill tone="warn">APPROVAL REQUIRED</Pill>}
                <Pill tone={statusToneOf(o.status)}>{o.status.replace('_', ' ')}</Pill>
                <span className="text-[11px] text-muted ml-auto uppercase">{o.source}</span>
              </div>
              {o.description && <p className="text-xs text-muted mt-1">{o.description}</p>}
            </div>
          ))}
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 12 — Rules */}
        <Section title="SEO Rules (never change without owner)">
          <div className="card p-5">
            <ul className="text-xs space-y-1.5">
              {(rules ?? []).map((r: any) => (
                <li key={r.id} className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${r.rule_type === 'approval' || r.rule_type === 'safety' ? 'bg-red-400' : 'bg-honey'}`} />
                  <span><b>{r.rule_name}.</b> <span className="text-muted">{r.rule_description}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* Sidebar content — capabilities + tools */}
        <div>
          <Section title="Capabilities">
            <div className="card p-4 space-y-1.5">
              {(caps ?? []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.capability_name}</span>
                  <Pill tone={c.permission_level === 'approval_required' ? 'warn' : c.permission_level === 'draft' ? 'honey' : 'neutral'}>{c.permission_level.replace('_', ' ')}</Pill>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Tool Connections">
            <div className="card p-4 space-y-1.5">
              {(tools ?? []).map((t: any) => (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{t.tool_name}</span>
                    <Pill tone={t.status === 'connected' ? 'good' : 'honey'}>{t.status}</Pill>
                  </div>
                  {t.notes && <p className="text-[10px] text-muted">{t.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* 13 — Performance */}
      <Section title="SEO Performance">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-3"><div className="text-[11px] text-muted">Organic revenue (90d)</div><div className="text-lg font-semibold tabular-nums text-emerald-700">{P?.organic_revenue ? money(P.organic_revenue) : '—'}</div><div className="text-[10px] text-muted">GA4 (real)</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Top-3 keywords</div><div className="text-lg font-semibold tabular-nums">{P?.top_3_keywords ?? '—'}</div><div className="text-[10px] text-muted">Semrush baseline</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Pages missing meta</div><div className="text-lg font-semibold tabular-nums text-amber-700">{P?.pages_missing_meta ?? '—'}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Thin-content pages</div><div className="text-lg font-semibold tabular-nums text-amber-700">{P?.pages_with_thin_content ?? '—'}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Implemented optimisations</div><div className="text-lg font-semibold tabular-nums">{P?.implemented_optimisations ?? 0}</div></div>
        </div>
        <p className="text-[11px] text-muted mt-2">Organic sessions, ranking counts, gains/losses and GEO visibility score populate from the daily Semrush runs and future GSC import — shown as [DATA NEEDED] rather than invented.</p>
      </Section>
    </>
  );
}
