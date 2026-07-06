import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { CommandComposer } from '@/components/command/CommandComposer';
import { ApprovalActions, RiskActions } from '@/components/command/ActionButtons';
import { ItemApproval } from '@/components/command/ItemApproval';
import { CompletedWork, type DoneItem } from '@/components/command/CompletedWork';
import { AgentReport } from '@/components/command/AgentReport';
import { AgentConversations } from '@/components/command/AgentConversations';
import { priorityTone, riskTone, money, type Agent, type OwnerApproval, type OwnerRisk } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Marketing Agent — Marketing / CRO / Growth module. Owner-only. Suggest-only:
// never changes budgets, launches/pauses ads, sends email, edits Shopify or
// discounts. Approvals execute immediately via the Mac Studio runner (work
// product only — spend execution stays with the owner). PREMIUM/OUTLET separate.
// -----------------------------------------------------------------------------

type Tone = 'good' | 'honey' | 'danger' | 'warn' | 'neutral' | 'info';
const prio = (p: string) => priorityTone(p as any);
const st = (s: string): Tone =>
  ['implemented', 'completed', 'live', 'ready', 'working'].includes(s) ? 'good'
  : ['approved', 'running', 'in_production', 'scale'].includes(s) ? 'info'
  : s === 'needs_approval' ? 'warn'
  : ['dismissed', 'cancelled'].includes(s) ? 'neutral'
  : ['wasting', 'underperforming'].includes(s) ? 'danger'
  : s === 'new_launch' ? 'honey'
  : 'honey';
const brandPill = (b: string): Tone => (b === 'outlet' ? 'info' : 'honey');

export default async function MarketingAgentModule({ searchParams }: { searchParams: { range?: string } }) {
  await requireAdmin();
  const sb = createClient();
  const range = searchParams.range === '7d' ? 'last_7_days' : 'last_30_days';

  const { data: agentRow } = await sb.from('agents').select('*').eq('slug', 'marketing-agent').single();
  const agent = agentRow as Agent | null;

  const [
    { data: paid }, { data: blended }, { data: cro }, { data: funnel }, { data: creative },
    { data: email }, { data: calendar }, { data: experiments }, { data: budget }, { data: ledger },
    { data: caps }, { data: tools }, { data: approvals }, { data: risks }, { data: updates },
  ] = await Promise.all([
    sb.from('mkt_paid_campaigns').select('*').order('spend', { ascending: false, nullsFirst: false }),
    sb.from('mkt_blended_performance').select('*').eq('period_label', range).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('mkt_cro_opportunities').select('*').neq('approval_status', 'dismissed').order('priority'),
    sb.from('mkt_funnel_snapshots').select('*').order('sessions', { ascending: false, nullsFirst: false }),
    sb.from('mkt_creative_requests').select('*').neq('status', 'dismissed').order('priority'),
    sb.from('mkt_email_opportunities').select('*').neq('status', 'dismissed').order('priority'),
    sb.from('mkt_campaign_calendar').select('*').neq('status', 'cancelled').order('starts_on', { ascending: true, nullsFirst: false }),
    sb.from('mkt_growth_experiments').select('*').neq('status', 'dismissed').order('priority'),
    sb.from('mkt_budget_recommendations').select('*').neq('status', 'dismissed').order('priority'),
    sb.from('mkt_growth_ledger').select('*').order('ledger_ref'),
    agent ? sb.from('agent_capabilities').select('*').eq('agent_id', agent.id).order('created_at') : Promise.resolve({ data: [] }),
    agent ? sb.from('agent_tool_connections').select('*').eq('agent_id', agent.id).order('created_at') : Promise.resolve({ data: [] }),
    agent ? sb.from('owner_approvals').select('*').eq('agent_id', agent.id).eq('status', 'pending') : Promise.resolve({ data: [] }),
    agent ? sb.from('owner_risks').select('*').eq('agent_id', agent.id).in('status', ['open', 'acknowledged']) : Promise.resolve({ data: [] }),
    agent ? sb.from('agent_updates').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
  ]);

  const PAID = (paid ?? []) as any[];
  const B = blended as any;
  const CRO = (cro ?? []) as any[];
  const FUN = (funnel ?? []) as any[];
  const CRE = (creative ?? []) as any[];
  const EM = (email ?? []) as any[];
  const CAL = (calendar ?? []) as any[];
  const EXP = (experiments ?? []) as any[];
  const BUD = (budget ?? []) as any[];
  const LED = (ledger ?? []) as any[];
  const AP = (approvals ?? []) as OwnerApproval[];
  const RK = (risks ?? []) as OwnerRisk[];
  const lastRun = (updates ?? [])[0] as any;

  // Aggregated approval queue across all marketing tables.
  const q = (rows: any[], col: string) => rows.filter((r) => r[col] === 'needs_approval');
  const approvalItems = [
    ...q(CRO, 'approval_status').map((r) => ({ table: 'mkt_cro_opportunities', id: r.id, tag: 'CRO', title: r.title, detail: `${r.issue ?? ''}\nEvidence: ${r.evidence ?? '[DATA NEEDED]'}\nFix: ${r.suggested_fix ?? ''}\nMetric: ${r.metric_to_move ?? ''}`, priority: r.priority, brand: r.brand })),
    ...q(CRE, 'status').map((r) => ({ table: 'mkt_creative_requests', id: r.id, tag: 'creative', title: r.title, detail: `${r.angle ?? ''} · ${r.format ?? ''}${r.notes ? `\n${r.notes}` : ''}`, priority: r.priority, brand: r.brand })),
    ...q(EM, 'status').map((r) => ({ table: 'mkt_email_opportunities', id: r.id, tag: `${r.platform} email`, title: r.title, detail: `${r.description ?? ''}${r.expected_impact ? `\nExpected: ${r.expected_impact}` : ''}`, priority: r.priority, brand: r.brand })),
    ...q(CAL, 'status').map((r) => ({ table: 'mkt_campaign_calendar', id: r.id, tag: 'campaign', title: r.name, detail: `${r.description ?? ''}${r.proposed_budget ? `\nProposed budget: ${money(r.proposed_budget)}` : ''}`, priority: 'high', brand: r.brand })),
    ...q(EXP, 'status').map((r) => ({ table: 'mkt_growth_experiments', id: r.id, tag: 'experiment', title: r.name, detail: `${r.hypothesis ?? ''}\nMetric: ${r.metric ?? ''} · impact ${r.expected_impact} · effort ${r.effort}`, priority: r.priority, brand: r.brand })),
    ...q(BUD, 'status').map((r) => ({ table: 'mkt_budget_recommendations', id: r.id, tag: 'budget', title: r.title, detail: `${r.move_from ? `From: ${r.move_from}\n` : ''}${r.move_to ? `To: ${r.move_to}\n` : ''}${r.amount ? `Amount: ${money(r.amount)}\n` : ''}${r.rationale ?? ''}`, priority: r.priority, brand: r.brand })),
  ];

  const doneExtras: DoneItem[] = [
    ...CRO.filter((r) => r.approval_status === 'implemented').map((r) => ({ kind: 'CRO', title: r.title, detail: r.suggested_fix, when: r.updated_at })),
    ...EXP.filter((r) => r.status === 'completed').map((r) => ({ kind: 'experiment', title: r.name, detail: r.result ?? r.learnings, when: r.updated_at })),
    ...BUD.filter((r) => r.status === 'implemented').map((r) => ({ kind: 'budget', title: r.title, detail: r.rationale?.slice(0, 120), when: r.updated_at })),
    ...EM.filter((r) => r.status === 'implemented').map((r) => ({ kind: 'email', title: r.title, detail: r.description?.slice(0, 120), when: r.updated_at })),
  ];

  const Pill = CCBadge;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Link href="/command-centre/agents" className="text-xs text-honey hover:underline">← Agents</Link>
        <h1 className="text-xl font-semibold">Marketing Agent — Marketing · CRO · Growth</h1>
        <Pill tone="good">{agent?.status ?? 'active'}</Pill>
        <Pill tone="warn">SUGGEST ONLY</Pill>
        <Pill tone="danger">NEVER SPENDS</Pill>
      </div>
      <p className="text-sm text-muted mb-6">
        Runs daily 7:45am on the Mac Studio, sharing the Growth Ledger with the SEO agent. It analyses, designs and
        stages — it never changes budgets, launches or pauses ads, sends email, edits Shopify or touches discounts.
        PREMIUM and OUTLET are tracked separately, always.
      </p>

      {agent && <AgentConversations agentId={agent.id} />}

      {/* Approvals first */}
      <Section title={`Approvals — Action Required (${approvalItems.length})`}>
        {approvalItems.length === 0 ? <EmptyState>Nothing waiting on you.</EmptyState> : (
          <div className="space-y-3">
            {approvalItems.map((i) => (
              <div key={i.id} className="card p-4 ring-1 ring-amber-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Pill tone="warn">APPROVAL REQUIRED</Pill>
                      <Pill tone="info">{i.tag}</Pill>
                      <span className="font-medium text-sm">{i.title}</span>
                      <Pill tone={prio(i.priority)}>{i.priority}</Pill>
                      <Pill tone={brandPill(i.brand)}>{i.brand}</Pill>
                    </div>
                    <p className="text-xs text-muted whitespace-pre-wrap">{i.detail}</p>
                  </div>
                  <ItemApproval table={i.table} id={i.id} />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted mt-2">Approving starts the agent immediately (work product only — nothing spends or sends when you click). Add a note to give instructions.</p>
      </Section>

      {/* Overview — full blended MER (Google + Meta), 7d/30d toggle */}
      <Section title="Marketing Overview" action={
        <div className="flex items-center gap-2 text-xs">
          <Link href="?range=7d" className={`rounded-full px-3 py-1.5 ring-1 ${range === 'last_7_days' ? 'bg-ink text-cream ring-ink' : 'bg-white ring-beige hover:bg-sand'}`}>Last 7 days</Link>
          <Link href="?range=30d" className={`rounded-full px-3 py-1.5 ring-1 ${range === 'last_30_days' ? 'bg-ink text-cream ring-ink' : 'bg-white ring-beige hover:bg-sand'}`}>Last 30 days</Link>
        </div>
      }>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-3">
            <div className="text-[11px] text-muted">Total AU ad spend ({range === 'last_7_days' ? '7d' : '30d'})</div>
            <div className="text-xl font-semibold tabular-nums">{money(B?.total_ad_spend)}</div>
            <div className="text-[10px] text-muted">Google {money(B?.google_spend)} + Meta {money(B?.meta_spend)}</div>
          </div>
          <div className="card p-3">
            <div className="text-[11px] text-muted">Blended MER ({range === 'last_7_days' ? '7d' : '30d'})</div>
            <div className={`text-xl font-semibold tabular-nums ${B?.mer && Number(B.mer) < 4 ? 'text-red-600' : 'text-emerald-700'}`}>{B?.mer ? `${Number(B.mer).toFixed(1)}×` : '—'}</div>
            <div className="text-[10px] text-muted">{B?.mer ? `ad spend = ${(100 / Number(B.mer)).toFixed(1)}% of revenue` : ''} · rev {money(B?.blended_revenue)} ÷ spend {money(B?.total_ad_spend)}</div>
          </div>
          <div className="card p-3"><div className="text-[11px] text-muted">Google ROAS ({range === 'last_7_days' ? '7d' : '30d'})</div><div className="text-xl font-semibold tabular-nums">{B?.google_roas ? `${Number(B.google_roas).toFixed(1)}×` : '—'}</div><div className="text-[10px] text-muted">{B?.attributed_revenue ? `platform-attributed ${money(B.attributed_revenue)}` : 'platform-attributed [DATA NEEDED this window]'}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Meta ROAS</div><div className="text-xl font-semibold tabular-nums text-muted">[DATA NEEDED]</div><div className="text-[10px] text-muted">purchase-value field unmapped; purchases tracked</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">International ad spend</div><div className="text-xl font-semibold tabular-nums text-emerald-700">$33/day</div><div className="text-[10px] text-muted">NZ Phase 1 LIVE 4 Jul (PMax $25 + Brand $8)</div></div>
        </div>
        <p className="text-[11px] text-muted mt-2">MER = website revenue (GA4) ÷ total ad spend (Google + Meta, both real). In-store Fresha revenue will lift MER when connected; Meta purchase value adds Meta ROAS. Refreshed daily by the 6am sync.</p>
      </Section>

      {/* Reports from the agent — the manager's inbox */}
      <Section title="Reports From Your Agent">
        {(updates ?? []).length === 0 ? <EmptyState>No reports yet — they file here automatically when work completes.</EmptyState> : (
          <div className="space-y-2">
            {(updates ?? []).map((u: any) => (
              <details key={u.id} className="card p-4">
                <summary className="cursor-pointer flex items-center gap-2 flex-wrap">
                  <Pill tone={u.update_type === 'error' ? 'danger' : u.update_type === 'success' ? 'good' : 'info'}>{u.update_type === 'success' ? 'REPORT' : u.update_type}</Pill>
                  <span className="text-sm font-medium">{u.title}</span>
                  <span className="text-[11px] text-muted ml-auto">{new Date(u.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </summary>
                {u.summary && <div className="mt-3 border-t border-beige pt-3"><AgentReport text={u.summary} /></div>}
              </details>
            ))}
          </div>
        )}
      </Section>

      {/* Command */}
      <Section title="Command Marketing Agent">
        <div className="card p-5">
          {agent && <CommandComposer agents={[{ id: agent.id, name: 'Marketing Agent', status: agent.status }]}
            placeholder={'e.g. "What is wasting money right now?" · "Design the NZ launch test." · "Where is conversion leaking on mobile?"'} />}
        </div>
      </Section>

      {/* What's working / wasting */}
      <Section title="Paid Media — What's Working vs What Needs Attention">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Campaign</th><th className="th">Brand</th><th className="th">Spend (30d)</th><th className="th">Conv</th><th className="th">Revenue</th><th className="th">ROAS</th><th className="th">Verdict</th><th className="th">Notes</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {PAID.map((p) => (
                <tr key={p.id} className="hover:bg-cream/60">
                  <td className="td font-medium text-sm">{p.campaign_name}</td>
                  <td className="td"><Pill tone={brandPill(p.brand)}>{p.brand}</Pill></td>
                  <td className="td tabular-nums text-xs">{p.spend != null ? money(p.spend) : '—'}</td>
                  <td className="td tabular-nums text-xs">{p.conversions ?? '—'}</td>
                  <td className="td tabular-nums text-xs">{p.revenue != null ? money(p.revenue) : '—'}</td>
                  <td className="td tabular-nums font-medium">{p.roas != null ? `${Number(p.roas).toFixed(1)}×` : '—'}</td>
                  <td className="td"><Pill tone={st(p.verdict)}>{p.verdict.replace('_', ' ')}</Pill></td>
                  <td className="td text-[11px] text-muted max-w-xs">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Funnel + international */}
      <Section title="Conversion Funnel by Market (GA4, last 90 days — real)">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Market</th><th className="th">Sessions</th><th className="th">Orders</th><th className="th">Revenue</th><th className="th">CVR</th><th className="th">Read</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {FUN.map((f) => (
                <tr key={f.id} className="hover:bg-cream/60">
                  <td className="td font-medium">{f.segment}</td>
                  <td className="td tabular-nums">{f.sessions?.toLocaleString('en-AU')}</td>
                  <td className="td tabular-nums">{f.orders}</td>
                  <td className="td tabular-nums">{money(f.revenue)}</td>
                  <td className="td tabular-nums font-medium">{f.conversion_rate != null ? `${Number(f.conversion_rate).toFixed(2)}%` : '—'}</td>
                  <td className="td text-[11px] text-muted max-w-sm">{f.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted mt-2">International expansion is gated: fix checkout (CRO item above) → NZ first → US. Full plan: <span className="font-mono">arms/marketing/international-optimisation-plan.md</span></p>
      </Section>

      {/* CRO */}
      <Section title="CRO Opportunities — Where Conversion Is Leaking">
        <div className="space-y-2">
          {CRO.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{c.title}</span>
                <Pill tone={prio(c.priority)}>{c.priority}</Pill>
                <Pill tone={st(c.approval_status)}>{c.approval_status.replace('_', ' ')}</Pill>
                {c.page_or_funnel && <span className="text-[11px] font-mono text-muted">{c.page_or_funnel}</span>}
              </div>
              {c.evidence && <p className="text-xs mt-1"><span className="text-muted">Evidence:</span> {c.evidence}</p>}
              {c.suggested_fix && <p className="text-xs mt-0.5"><span className="text-muted">Fix:</span> {c.suggested_fix}</p>}
              {c.metric_to_move && <p className="text-[11px] text-honey mt-0.5">Metric: {c.metric_to_move}</p>}
            </div>
          ))}
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Creative pipeline */}
        <Section title="Creative Pipeline">
          <div className="space-y-2">
            {CRE.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{c.title}</span>
                  <Pill tone={st(c.status)}>{c.status.replace('_', ' ')}</Pill>
                  <Pill tone={prio(c.priority)}>{c.priority}</Pill>
                  <Pill tone={brandPill(c.brand)}>{c.brand}</Pill>
                </div>
                <p className="text-xs text-muted mt-1">{c.angle} · {c.format}</p>
                {c.notes && <p className="text-[11px] text-muted mt-0.5">{c.notes}</p>}
              </div>
            ))}
          </div>
        </Section>

        {/* Email */}
        <Section title="Email / SMS Opportunities (Klaviyo = Premium · Omnisend = Outlet)">
          <div className="space-y-2">
            {EM.map((e) => (
              <div key={e.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill tone="info">{e.platform}</Pill>
                  <span className="font-medium text-sm">{e.title}</span>
                  <Pill tone={st(e.status)}>{e.status.replace('_', ' ')}</Pill>
                  <Pill tone={brandPill(e.brand)}>{e.brand}</Pill>
                </div>
                {e.description && <p className="text-xs text-muted mt-1">{e.description}</p>}
                {e.expected_impact && <p className="text-[11px] text-emerald-700 mt-0.5">{e.expected_impact}</p>}
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Calendar + experiments */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Campaign Calendar">
          <div className="space-y-2">
            {CAL.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{c.name}</span>
                  <Pill tone={st(c.status)}>{c.status.replace('_', ' ')}</Pill>
                  <Pill tone={brandPill(c.brand)}>{c.brand}</Pill>
                  {c.starts_on && <span className="text-[11px] text-muted">{c.starts_on}</span>}
                </div>
                {c.description && <p className="text-xs text-muted mt-1">{c.description}</p>}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Growth Experiments">
          <div className="space-y-2">
            {EXP.map((x) => (
              <div key={x.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{x.name}</span>
                  <Pill tone={st(x.status)}>{x.status.replace('_', ' ')}</Pill>
                  <Pill tone={prio(x.priority)}>{x.priority}</Pill>
                </div>
                {x.hypothesis && <p className="text-xs text-muted mt-1">{x.hypothesis}</p>}
                {x.metric && <p className="text-[11px] text-honey mt-0.5">Metric: {x.metric} · impact {x.expected_impact} · effort {x.effort}</p>}
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Growth ledger */}
      <Section title="Shared Growth Ledger (with the SEO Agent)">
        <div className="space-y-2">
          {LED.map((l) => (
            <div key={l.id} className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill tone="honey">{l.ledger_ref}</Pill>
                <span className="font-medium text-sm">{l.title}</span>
                <Pill tone={brandPill(l.brand)}>{l.brand}</Pill>
                <Pill tone={l.confidence === 'high' ? 'good' : 'neutral'}>confidence: {l.confidence}</Pill>
                <span className="text-[11px] text-muted ml-auto">{l.source_arm}</span>
              </div>
              {l.evidence && <p className="text-xs mt-1"><span className="text-muted">Evidence:</span> {l.evidence}</p>}
              {l.cross_arm_implication && <p className="text-[11px] text-honey mt-0.5">Cross-arm: {l.cross_arm_implication}</p>}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-2">Canonical ledger: <span className="font-mono">knowledge/marketing/GROWTH-LEDGER.md</span> — both agents read it at run start and append learnings at run end.</p>
      </Section>

      {/* Owner approvals + risks (formal) */}
      {(AP.length > 0 || RK.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          <Section title="Formal Approvals (owner desk)">
            {AP.map((a) => (
              <div key={a.id} className="card p-4 mb-2">
                <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{a.title}</span><Pill tone={prio(a.priority)}>{a.priority}</Pill></div>
                <ApprovalActions id={a.id} />
              </div>
            ))}
          </Section>
          <Section title="Open Risks">
            {RK.map((r) => (
              <div key={r.id} className="card p-4 mb-2">
                <div className="flex items-center gap-2 mb-1"><Pill tone={riskTone(r.risk_level)}>{r.risk_level}</Pill><span className="font-medium text-sm">{r.title}</span></div>
                <RiskActions id={r.id} />
              </div>
            ))}
          </Section>
        </div>
      )}

      {/* Completed work */}
      <CompletedWork agentId={agent?.id ?? null} extraItems={doneExtras} />

      {/* Capabilities + tools */}
      <div className="grid md:grid-cols-2 gap-6">
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
    </>
  );
}
