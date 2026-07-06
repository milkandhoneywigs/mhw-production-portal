import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { CommandComposer } from '@/components/command/CommandComposer';
import { ApprovalActions } from '@/components/command/ActionButtons';
import { RiskActions } from '@/components/command/ActionButtons';
import { OpportunityActions } from '@/components/command/OpportunityActions';
import { CompletedWork, type DoneItem } from '@/components/command/CompletedWork';
import { priorityTone, riskTone, money, type Agent, type OwnerApproval, type OwnerRisk } from '@/lib/command-centre/cc';
import { AgentConversations } from '@/components/command/AgentConversations';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Claudia — the Customer Service agent's dedicated module. Owner-only.
// Draft-only posture: internal Gorgias notes for human approval; auto-send is
// DISABLED; tracking must be checked before any shipping reply; replies sign as
// Claudia (no emojis, no em dashes, never mention AI).
// -----------------------------------------------------------------------------

const confidenceTone = (l: string) => (l === 'high' ? 'good' : l === 'medium' ? 'honey' : 'danger') as 'good' | 'honey' | 'danger';
const modeLabel: Record<string, string> = {
  read_only: 'READ ONLY', draft_only: 'DRAFT ONLY', approval_required: 'APPROVAL REQUIRED', auto_allowed_later: 'AUTO (LATER)',
};
const sentimentTone = (s: string) =>
  (s === 'positive' ? 'good' : s === 'neutral' ? 'neutral' : s === 'distressed' ? 'warn' : s === 'unknown' ? 'neutral' : 'danger') as any;

export default async function ClaudiaModule() {
  await requireAdmin();
  const sb = createClient();

  const { data: agentRow } = await sb.from('agents').select('*').eq('slug', 'claudia-customer-service').single();
  const agent = agentRow as Agent | null;

  const [
    { data: topics }, { data: perf }, { data: staff }, { data: opps }, { data: tone },
    { data: gaps }, { data: insights }, { data: approvals }, { data: risks }, { data: updates },
  ] = await Promise.all([
    sb.from('claudia_topic_confidence').select('*').eq('active', true).order('confidence_score', { ascending: false }),
    sb.from('claudia_performance_metrics').select('*').order('created_at', { ascending: false }),
    sb.from('claudia_staff_review_metrics').select('*').order('drafts_reviewed', { ascending: false }),
    sb.from('claudia_optimisation_opportunities').select('*').neq('status', 'dismissed').order('priority').order('created_at'),
    sb.from('claudia_tone_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('claudia_knowledge_gaps').select('*').neq('status', 'dismissed').order('priority'),
    sb.from('claudia_ticket_insights').select('*').order('created_at', { ascending: false }).limit(10),
    agent ? sb.from('owner_approvals').select('*').eq('agent_id', agent.id).eq('status', 'pending') : Promise.resolve({ data: [] }),
    agent ? sb.from('owner_risks').select('*').eq('agent_id', agent.id).in('status', ['open', 'acknowledged']) : Promise.resolve({ data: [] }),
    agent ? sb.from('agent_updates').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }).limit(3) : Promise.resolve({ data: [] }),
  ]);

  const T = (topics ?? []) as any[];
  const P = (perf ?? []) as any[];
  const byLabel = (l: string) => P.find((p) => p.period_label === l);
  const week = byLabel('this_week');
  const AP = (approvals ?? []) as OwnerApproval[];
  const RK = (risks ?? []) as OwnerRisk[];
  const TN = tone as any;
  const lastRun = (updates ?? [])[0] as any;

  const grouped = {
    high: T.filter((t) => t.confidence_level === 'high'),
    medium: T.filter((t) => t.confidence_level === 'medium'),
    low: T.filter((t) => t.confidence_level === 'low'),
  };
  const avgConfidence = T.length ? T.reduce((s, t) => s + Number(t.confidence_score ?? 0), 0) / T.length : null;

  const Pill = ({ children, tone: tn = 'neutral' }: { children: React.ReactNode; tone?: any }) => (
    <CCBadge tone={tn}>{children}</CCBadge>
  );

  // Completed module work for the Completed Work record.
  const doneExtras: DoneItem[] = [
    ...((opps ?? []) as any[]).filter((o) => o.status === 'completed').map((o) => ({
      kind: 'optimisation', title: o.title, detail: o.description?.slice(0, 140), when: o.updated_at,
    })),
    ...((gaps ?? []) as any[]).filter((g) => g.status === 'resolved').map((g) => ({
      kind: 'training', title: `Knowledge gap closed: ${g.gap_title}`, detail: g.suggested_training_content, when: g.updated_at,
    })),
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Link href="/command-centre/agents" className="text-xs text-honey hover:underline">← Agents</Link>
        <h1 className="text-xl font-semibold">Claudia — Customer Service</h1>
        <Pill tone="good">{agent?.status ?? 'active'}</Pill>
        <Pill tone="warn">HUMAN REVIEW</Pill>
        <Pill tone="danger">AUTO-SEND DISABLED</Pill>
        <a href="https://mhwigs.gorgias.com" target="_blank" rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-ink text-cream text-xs font-medium px-3 py-1.5 hover:bg-ink/85 transition">
          Open Gorgias ↗
        </a>
      </div>
      <p className="text-sm text-muted mb-6">
        Claudia drafts customer replies as internal Gorgias notes for human approval. She signs as Claudia, checks live
        tracking before any shipping reply, and never sends to a customer herself.
      </p>

      {agent && <AgentConversations agentId={agent.id} />}

      {/* 1 — Overview */}
      <Section title="Claudia Overview">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card p-3"><div className="text-[11px] text-muted">Current mode</div><div className="text-sm font-semibold mt-0.5">Internal Gorgias notes only</div><div className="mt-1"><Pill tone="warn">APPROVAL REQUIRED</Pill></div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Last run</div><div className="text-sm font-semibold mt-0.5">{lastRun ? new Date(lastRun.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'awaiting first report'}</div><div className="text-[11px] text-muted mt-1">hourly on the Mac Studio</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Open approvals</div><div className={`text-xl font-semibold tabular-nums ${AP.length ? 'text-amber-700' : ''}`}>{AP.length}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">High-risk tickets</div><div className={`text-xl font-semibold tabular-nums ${RK.length ? 'text-red-600' : ''}`}>{RK.length}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Avg topic confidence</div><div className="text-xl font-semibold tabular-nums">{avgConfidence != null ? `${Math.round(avgConfidence * 100)}%` : '—'}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Customer rating</div><div className="text-xl font-semibold tabular-nums">{week?.customer_rating_average ?? '—'}</div><div className="text-[11px] text-muted">[DATA NEEDED: Gorgias CSAT]</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Drafts this week</div><div className="text-xl font-semibold tabular-nums">{week?.drafts_created ?? '—'}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Approved as-is</div><div className="text-xl font-semibold tabular-nums">{week ? `${Number(week.approval_rate).toFixed(0)}%` : '—'}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Edited by staff</div><div className="text-xl font-semibold tabular-nums text-amber-700">{week ? `${Number(week.edit_rate).toFixed(0)}%` : '—'}</div></div>
          <div className="card p-3"><div className="text-[11px] text-muted">Est. time saved (week)</div><div className="text-xl font-semibold tabular-nums text-emerald-700">{week?.estimated_time_saved_minutes ? `${Math.round(week.estimated_time_saved_minutes / 60)}h` : '—'}</div></div>
        </div>
        <p className="text-[11px] text-muted mt-2">Performance figures are DEMO estimates until Gorgias connects; topic matrix and rules are live configuration.</p>
      </Section>

      {/* 2 — Command Claudia */}
      <Section title="Command Claudia">
        <div className="card p-5">
          {agent && <CommandComposer agents={[{ id: agent.id, name: 'Claudia', status: agent.status }]}
            placeholder={'e.g. "What are customers complaining about this week?" · "Which replies are staff editing most?" · "Where are you least confident?"'} />}
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 3 — Needs approval */}
        <Section title="Needs Approval">
          {AP.length === 0 ? <EmptyState>No Claudia approvals pending.</EmptyState> : (
            <div className="space-y-3">
              {AP.map((a) => (
                <div key={a.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-1"><span className="font-medium text-sm">{a.title}</span><Pill tone={priorityTone(a.priority)}>{a.priority}</Pill></div>
                  {a.description && <p className="text-xs text-muted mb-2">{a.description}</p>}
                  {a.financial_impact != null && <p className="text-xs font-medium mb-2">{money(a.financial_impact, a.currency ?? 'AUD')}</p>}
                  <ApprovalActions id={a.id} />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 4 — Open risks */}
        <Section title="Open Risks">
          {RK.length === 0 ? <EmptyState>No open Claudia risks.</EmptyState> : (
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

      {/* 5 — Confidence & topic matrix */}
      <Section title="Confidence & Topic Matrix">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="card p-3 text-center"><div className="text-xl font-semibold text-emerald-700">{grouped.high.length}</div><div className="text-[11px] text-muted">HIGH CONFIDENCE · draft allowed</div></div>
          <div className="card p-3 text-center"><div className="text-xl font-semibold text-honey">{grouped.medium.length}</div><div className="text-[11px] text-muted">MEDIUM · draft for approval</div></div>
          <div className="card p-3 text-center"><div className="text-xl font-semibold text-red-600">{grouped.low.length}</div><div className="text-[11px] text-muted">LOW · approval required</div></div>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Topic</th><th className="th">Category</th><th className="th">Confidence</th><th className="th">Mode</th><th className="th">Current rule</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {T.map((t) => (
                <tr key={t.id} className="hover:bg-cream/60">
                  <td className="td font-medium">{t.topic_name}</td>
                  <td className="td text-xs">{t.topic_category}</td>
                  <td className="td"><Pill tone={confidenceTone(t.confidence_level)}>{t.confidence_level} {t.confidence_score != null ? `· ${Math.round(t.confidence_score * 100)}%` : ''}</Pill></td>
                  <td className="td"><Pill tone={t.action_mode === 'draft_only' ? 'good' : 'warn'}>{modeLabel[t.action_mode] ?? t.action_mode}</Pill></td>
                  <td className="td text-xs text-muted max-w-md">{t.current_rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6 — Performance */}
      <Section title="Performance">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Period</th><th className="th">Tickets</th><th className="th">Drafts</th><th className="th">Approved</th><th className="th">Edited</th><th className="th">Rejected</th><th className="th">Approval rate</th><th className="th">Edit rate</th><th className="th">Escalation</th><th className="th">Time saved</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {['today', 'this_week', 'this_month'].map((label) => {
                const p = byLabel(label);
                if (!p) return null;
                return (
                  <tr key={label} className="hover:bg-cream/60">
                    <td className="td font-medium capitalize">{label.replace('_', ' ')}</td>
                    <td className="td tabular-nums">{p.tickets_reviewed}</td>
                    <td className="td tabular-nums">{p.drafts_created}</td>
                    <td className="td tabular-nums text-emerald-700">{p.drafts_approved}</td>
                    <td className="td tabular-nums text-amber-700">{p.drafts_edited}</td>
                    <td className="td tabular-nums text-red-600">{p.drafts_rejected}</td>
                    <td className="td tabular-nums">{Number(p.approval_rate).toFixed(0)}%</td>
                    <td className="td tabular-nums">{Number(p.edit_rate).toFixed(0)}%</td>
                    <td className="td tabular-nums">{Number(p.escalation_rate).toFixed(0)}%</td>
                    <td className="td tabular-nums">{Math.round((p.estimated_time_saved_minutes ?? 0) / 60)}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted mt-2">DEMO metrics until Gorgias connects. Goal: approval rate ↑, edit rate ↓ — that is Claudia growing.</p>
      </Section>

      {/* 7 — Staff review behaviour */}
      <Section title="Staff Review Behaviour">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Staff member</th><th className="th">Reviewed</th><th className="th">Approved</th><th className="th">Edited</th><th className="th">Rejected</th><th className="th">Avg review time</th><th className="th">Common edit reason</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {(staff ?? []).map((s: any) => (
                <tr key={s.id} className="hover:bg-cream/60">
                  <td className="td font-medium">{s.staff_name}</td>
                  <td className="td tabular-nums">{s.drafts_reviewed}</td>
                  <td className="td tabular-nums text-emerald-700">{s.approved_count}</td>
                  <td className="td tabular-nums text-amber-700">{s.edited_count}</td>
                  <td className="td tabular-nums text-red-600">{s.rejected_count}</td>
                  <td className="td tabular-nums">{s.average_review_time_minutes} min</td>
                  <td className="td text-xs text-muted max-w-sm">{s.common_edit_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 8 — Optimisation opportunities */}
      <Section title="Optimisation Opportunities">
        <div className="space-y-2">
          {(opps ?? []).map((o: any) => (
            <div key={o.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill tone="honey">OPTIMISATION</Pill>
                  <span className="font-medium text-sm">{o.title}</span>
                  <Pill tone={priorityTone(o.priority)}>{o.priority}</Pill>
                  <Pill tone={o.status === 'completed' ? 'good' : o.status === 'in_progress' ? 'info' : 'neutral'}>{o.status.replace('_', ' ')}</Pill>
                  <span className="text-[11px] text-muted">{o.opportunity_type.replace('_', ' ')}</span>
                </div>
                {o.description && <p className="text-xs text-muted mt-1">{o.description}</p>}
                {o.estimated_impact && <p className="text-[11px] text-emerald-700 mt-0.5">Impact: {o.estimated_impact}</p>}
              </div>
              <div className="shrink-0"><OpportunityActions id={o.id} status={o.status} /></div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 9 — Tone settings */}
        <Section title="Temperament & Tone">
          <div className="card p-5">
            {TN ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {(['warmth', 'empathy', 'formality', 'directness', 'policy_firmness', 'escalation_sensitivity', 'sales_tone'] as const).map((k) => (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-ink/80">{k.replace('_', ' ')}</span>
                      <span className="flex gap-1">
                        {['low', 'medium', 'high'].map((lvl) => (
                          <span key={lvl} className={`w-6 h-2 rounded-full ${TN[k] === lvl || (lvl === 'low') || (lvl === 'medium' && TN[k] === 'high') ? (TN[k] === lvl ? 'bg-honey' : 'bg-honey/40') : 'bg-beige'}`} title={`${k}: ${TN[k]}`} />
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-beige pt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Hard rules (never change without owner)</div>
                  <ul className="text-xs space-y-1">
                    {(TN.hard_rules ?? []).map((r: string, i: number) => (
                      <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />{r}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : <EmptyState>No tone settings yet.</EmptyState>}
          </div>
        </Section>

        {/* 10 — Knowledge gaps */}
        <Section title="Knowledge Gaps (training needed)">
          <div className="space-y-2">
            {(gaps ?? []).map((g: any) => (
              <div key={g.id} className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill tone={priorityTone(g.priority)}>{g.priority}</Pill>
                  <span className="font-medium text-sm">{g.gap_title}</span>
                  <Pill tone={g.status === 'resolved' ? 'good' : g.status === 'training_needed' ? 'warn' : 'neutral'}>{g.status.replace('_', ' ')}</Pill>
                  {g.source_ticket_count > 0 && <span className="text-[11px] text-muted">{g.source_ticket_count} tickets</span>}
                </div>
                {g.description && <p className="text-xs text-muted mt-1">{g.description}</p>}
                {g.suggested_training_content && <p className="text-[11px] text-honey mt-0.5">Training: {g.suggested_training_content}</p>}
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* What has been done — never wonder */}
      <CompletedWork agentId={agent?.id ?? null} extraItems={doneExtras} />

      {/* Trending customer issues */}
      <Section title="Trending Customer Issues">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-sand/60 border-b border-beige">
              <tr><th className="th">Topic</th><th className="th">Sentiment</th><th className="th">Risk</th><th className="th">Confidence</th><th className="th">Action</th><th className="th">Summary</th></tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {(insights ?? []).map((t: any) => (
                <tr key={t.id} className="hover:bg-cream/60">
                  <td className="td font-medium">{t.topic}</td>
                  <td className="td"><Pill tone={sentimentTone(t.sentiment)}>{t.sentiment}</Pill></td>
                  <td className="td"><Pill tone={riskTone(t.risk_level)}>{t.risk_level}</Pill></td>
                  <td className="td tabular-nums">{t.claudia_confidence != null ? `${Math.round(t.claudia_confidence * 100)}%` : '—'}</td>
                  <td className="td"><Pill tone={t.recommended_action === 'escalate' ? 'danger' : t.recommended_action === 'draft' ? 'good' : 'warn'}>{t.recommended_action.replace('_', ' ')}</Pill></td>
                  <td className="td text-xs text-muted max-w-sm">{t.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted mt-2">DEMO insights until Gorgias connects — then this becomes a live feed of what customers are raising.</p>
      </Section>
    </>
  );
}
