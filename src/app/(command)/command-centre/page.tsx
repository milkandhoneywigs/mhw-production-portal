import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CommandComposer } from '@/components/command/CommandComposer';
import { CCBadge } from '@/components/command/CCBadge';
import {
  statusTone, priorityTone, riskTone, agentStatusTone, money, STATUS_LABEL, MODULE_LABEL, APPROVAL_TYPE_LABEL,
  type Agent, type AgentCommand, type OwnerApproval, type OwnerRisk, type AgentUpdate, type BusinessTask, type FinancialSnapshot,
} from '@/lib/command-centre/cc';
import { getLiveOps } from '@/lib/command-centre/live';
import { getRevenueAnalytics } from '@/lib/command-centre/series';
import { TrendCard, TrendBadge } from '@/components/command/TrendCard';
import { Sparkline } from '@/components/command/Charts';
import { IdeaBox } from '@/components/command/IdeaBox';
import { AgentReport } from '@/components/command/AgentReport';

export const dynamic = 'force-dynamic';

function Metric({ label, value, tone = 'neutral', href }: { label: string; value: string | number; tone?: 'neutral' | 'warn' | 'danger' | 'good' | 'honey'; href?: string }) {
  const num = tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : tone === 'honey' ? 'text-honey' : 'text-ink';
  const inner = (
    <div className="card p-4 hover:shadow-md transition h-full">
      <div className={`text-2xl font-semibold tabular-nums ${num}`}>{value}</div>
      <div className="text-sm text-muted mt-1 leading-snug">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const MODULE_SHORTCUTS = [
  { label: 'Open Mabel Production Portal', href: '/production', live: true },
  { label: 'Claudia Customer Service', live: false },
  { label: 'SEO Agent', live: false },
  { label: 'Marketing Agent', live: false },
  { label: 'Inventory Agent', live: false },
  { label: 'Finance Agent', live: false },
  { label: 'Partnerships Agent', live: false },
];

export default async function OwnerDashboard() {
  const profile = await requireAdmin();
  const sb = createClient();

  const [{ data: agents }, { data: commands }, { data: approvals }, { data: risks }, { data: snap }, { data: updates }, { data: tasks }, { data: ideaCmds }] = await Promise.all([
    sb.from('agents').select('*').order('created_at'),
    sb.from('agent_commands').select('id,title,agent_id,status,priority,command_type,created_at,completed_at,result_summary').order('created_at', { ascending: false }).limit(50),
    sb.from('owner_approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    sb.from('owner_risks').select('*').in('status', ['open', 'acknowledged']).order('created_at', { ascending: false }),
    sb.from('financial_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    sb.from('agent_updates').select('*').order('created_at', { ascending: false }).limit(6),
    sb.from('business_tasks').select('*').in('status', ['todo', 'in_progress', 'blocked']).order('created_at', { ascending: false }).limit(8),
    sb.from('agent_commands').select('id,title,status,created_at,result_summary').ilike('title', 'Business plan:%').order('created_at', { ascending: false }).limit(4),
  ]);
  // Full plan text for completed idea plans.
  const ideaIds = ((ideaCmds ?? []) as { id: string }[]).map((c) => c.id);
  const { data: ideaResults } = ideaIds.length
    ? await sb.from('agent_command_results').select('command_id,content').in('command_id', ideaIds)
    : { data: [] as any[] };
  const planFor = (id: string) => (ideaResults ?? []).find((r: any) => r.command_id === id)?.content as string | undefined;
  // Pulse: alerts filed by the sentinels (site down / conversion down / opportunities).
  const pulseRisks = RKfilter((risks ?? []) as OwnerRisk[]);
  function RKfilter(rs: OwnerRisk[]) { return rs.filter((r) => r.title.startsWith('PULSE')); }

  const A = (agents ?? []) as Agent[];
  const C = (commands ?? []) as AgentCommand[];
  const AP = (approvals ?? []) as OwnerApproval[];
  const RK = (risks ?? []) as OwnerRisk[];
  const UP = (updates ?? []) as AgentUpdate[];
  const TK = (tasks ?? []) as BusinessTask[];
  const F = (snap ?? null) as FinancialSnapshot | null;
  const ops = await getLiveOps(sb); // live from the production DB (orders + invoices)
  const rev = await getRevenueAnalytics(sb, 30); // GA4 daily series
  const agentName = (id: string | null) => A.find((a) => a.id === id)?.name ?? '—';

  const today = new Date().toISOString().slice(0, 10);
  const count = (fn: (c: AgentCommand) => boolean) => C.filter(fn).length;
  const queued = count((c) => c.status === 'queued');
  const running = count((c) => c.status === 'running' || c.status === 'claimed');
  const failed = count((c) => c.status === 'failed');
  const completedToday = count((c) => c.status === 'completed' && (c.completed_at ?? '').slice(0, 10) === today);
  const highRisk = RK.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').length;

  return (
    <>
      <PageHeader title={`Welcome back, ${(profile.full_name || 'Yasmin').split(' ')[0]}`}
        subtitle="Beyond Reason Command Centre — what needs you today." />

      {/* PULSE — the portal watching the business. Site checks every 10 min,
          conversion/traffic hourly; alerts engage the right agent automatically. */}
      <div className={`card p-4 mb-6 ring-1 ${pulseRisks.length ? 'ring-red-200 bg-red-50/40' : 'ring-emerald-200 bg-emerald-50/30'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${pulseRisks.length ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-sm font-semibold">Business Pulse</span>
          {pulseRisks.length === 0 ? (
            <span className="text-sm text-emerald-800">All clear — site, checkout and conversion monitors report no active issues.</span>
          ) : (
            <span className="text-sm text-red-700 font-medium">{pulseRisks.length} active alert{pulseRisks.length === 1 ? '' : 's'}</span>
          )}
          <Link href="/command-centre/risks" className="text-xs text-honey hover:underline ml-auto">All risks →</Link>
        </div>
        {pulseRisks.slice(0, 3).map((r) => (
          <div key={r.id} className="mt-2 text-sm flex items-center gap-2">
            <CCBadge tone={riskTone(r.risk_level)}>{r.risk_level}</CCBadge>
            <span className="font-medium">{r.title.replace('PULSE: ', '')}</span>
            <span className="text-xs text-muted">{r.description?.slice(0, 100)}</span>
          </div>
        ))}
      </div>

      {/* Owner attention cards — operational metrics are LIVE from the production DB */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <Metric label="Pending approvals" value={AP.length} tone={AP.length ? 'warn' : 'neutral'} href="/command-centre/approvals" />
        <Metric label="Overdue in production" value={ops.overdueCount} tone={ops.overdueCount ? 'danger' : 'neutral'} href="/production?bucket=overdue" />
        <Metric label="High-risk orders" value={ops.highRiskCount} tone={ops.highRiskCount ? 'danger' : 'neutral'} href="/production?bucket=high_risk" />
        <Metric label="Orders in production" value={ops.ordersInProduction} tone="honey" href="/production" />
        <Metric label="Active orders" value={ops.totalActiveOrders} tone="neutral" href="/production" />
        <Metric label="Queued commands" value={queued} tone={queued ? 'honey' : 'neutral'} href="/command-centre/commands?status=queued" />
        <Metric label="Running commands" value={running} tone={running ? 'good' : 'neutral'} href="/command-centre/commands?status=running" />
        <Metric label="Supplier payments due" value={money(ops.supplierPaymentsDue)} tone={ops.supplierPaymentsDue ? 'warn' : 'neutral'} href="/command-centre/financials" />
        <Metric label="Balance payments due" value={money(ops.balancePaymentsDue)} tone={ops.balancePaymentsDue ? 'danger' : 'neutral'} href="/command-centre/financials" />
        <Metric label="Revenue (last 7 days)" value={money(F?.week_revenue)} tone="honey" href="/command-centre/financials" />
      </div>

      {/* Today's owner priorities */}
      <Section title="Today's Owner Priorities">
        {TK.length === 0 && AP.length === 0 && highRisk === 0 ? <EmptyState>Nothing needs you right now.</EmptyState> : (
          <div className="card divide-y divide-beige">
            {AP.slice(0, 3).map((a) => (
              <div key={a.id} className="p-3 flex items-center justify-between gap-3">
                <div><CCBadge tone="warn">Approval</CCBadge> <span className="text-sm ml-2">{a.title}</span></div>
                <Link href="/command-centre/approvals" className="text-xs text-honey hover:underline">Review →</Link>
              </div>
            ))}
            {RK.filter((r) => r.risk_level === 'high' || r.risk_level === 'critical').slice(0, 3).map((r) => (
              <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                <div><CCBadge tone={riskTone(r.risk_level)}>{r.risk_level} risk</CCBadge> <span className="text-sm ml-2">{r.title}</span></div>
                <Link href="/command-centre/risks" className="text-xs text-honey hover:underline">Open →</Link>
              </div>
            ))}
            {TK.slice(0, 4).map((t) => (
              <div key={t.id} className="p-3 flex items-center justify-between gap-3">
                <div><CCBadge tone={priorityTone(t.priority)}>{t.priority}</CCBadge> <span className="text-sm ml-2">{t.title}</span></div>
                <Link href="/command-centre/tasks" className="text-xs text-honey hover:underline">Tasks →</Link>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Command your agents */}
      <Section title="Command Your Agents">
        <div className="card p-5">
          <CommandComposer agents={A.map((a) => ({ id: a.id, name: a.name, status: a.status }))} />
        </div>
      </Section>

      {/* Financial snapshot — trend cards + 30-day sparkline (GA4) */}
      <Section title="Financial Snapshot" action={<Link href="/command-centre/financials" className="text-xs text-honey hover:underline">Full financials →</Link>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4 hover:shadow-md transition">
            <div className="text-xs font-medium text-muted">Online sales · last 30 days</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{money(rev.currentStats.revenue)}</div>
            <div className="mt-1 flex items-center gap-1.5"><TrendBadge change={rev.change.revenue} /><span className="text-[11px] text-muted">vs prev 30 days</span></div>
            <div className="mt-2 -mb-1"><Sparkline data={rev.current.map((p) => ({ date: p.date, revenue: p.revenue }))} /></div>
          </div>
          <TrendCard label="Average order value" value={rev.currentStats.aov != null ? money(rev.currentStats.aov) : '—'} change={rev.change.aov} />
          <TrendCard label="Orders (30 days)" value={String(rev.currentStats.transactions)} change={rev.change.transactions} />
          <TrendCard label="Conversion rate" value={rev.currentStats.conversion != null ? `${rev.currentStats.conversion.toFixed(2)}%` : '—'} change={rev.change.conversion} />
        </div>
        {F?.notes && <p className="text-xs text-muted mt-2">{F.notes}</p>}
      </Section>

      {/* Agent status */}
      <Section title="Agent Status" action={<Link href="/command-centre/agents" className="text-xs text-honey hover:underline">All agents →</Link>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {A.map((a) => (
            <Link key={a.id} href={`/command-centre/agents/${a.slug}`} className="card p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between"><span className="font-medium text-sm">{a.name}</span><CCBadge tone={agentStatusTone(a.status)}>{a.status}</CCBadge></div>
              <div className="text-xs text-muted mt-1">{a.business_area}</div>
              {a.next_action && <div className="text-xs mt-1 text-ink">Next: {a.next_action}</div>}
            </Link>
          ))}
        </div>
      </Section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Needs my approval */}
        <Section title="Needs My Approval">
          {AP.length === 0 ? <EmptyState>No approvals pending.</EmptyState> : (
            <div className="card divide-y divide-beige">
              {AP.slice(0, 5).map((a) => (
                <Link key={a.id} href="/command-centre/approvals" className="p-3 flex items-center justify-between gap-2 hover:bg-cream/60">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted">{APPROVAL_TYPE_LABEL[a.approval_type]} · {MODULE_LABEL[a.source_module]}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {a.financial_impact != null && <div className="text-sm tabular-nums">{money(a.financial_impact, a.currency ?? 'AUD')}</div>}
                    <CCBadge tone={priorityTone(a.priority)}>{a.priority}</CCBadge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* High-risk issues */}
        <Section title="High-Risk Issues">
          {RK.length === 0 ? <EmptyState>No open risks.</EmptyState> : (
            <div className="card divide-y divide-beige">
              {RK.slice(0, 5).map((r) => (
                <Link key={r.id} href="/command-centre/risks" className="p-3 flex items-center justify-between gap-2 hover:bg-cream/60">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted">{MODULE_LABEL[r.source_module]}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {r.financial_impact != null && <div className="text-sm tabular-nums">{money(r.financial_impact, r.currency ?? 'AUD')}</div>}
                    <CCBadge tone={riskTone(r.risk_level)}>{r.risk_level}</CCBadge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Latest agent updates */}
      <Section title="Latest Agent Updates">
        {UP.length === 0 ? <EmptyState>No updates yet.</EmptyState> : (
          <div className="card divide-y divide-beige">
            {UP.map((u) => (
              <div key={u.id} className="p-3">
                <div className="flex items-center gap-2">
                  <CCBadge tone={u.update_type === 'warning' ? 'warn' : u.update_type === 'error' ? 'danger' : u.update_type === 'success' ? 'good' : u.update_type === 'recommendation' ? 'honey' : 'info'}>{u.update_type}</CCBadge>
                  <span className="text-sm font-medium">{u.title}</span>
                  <span className="text-xs text-muted ml-auto">{agentName(u.agent_id)}</span>
                </div>
                {u.summary && <p className="text-xs text-muted mt-1">{u.summary}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Ideas -> business plans (the smart box) */}
      <Section title="Your Ideas — Turned Into Plans">
        <IdeaBox />
        {(ideaCmds ?? []).length > 0 && (
          <div className="space-y-2 mt-4">
            {((ideaCmds ?? []) as any[]).map((c) => {
              const plan = c.status === 'completed' ? planFor(c.id) : null;
              return (
                <details key={c.id} className="card p-4">
                  <summary className="cursor-pointer flex items-center gap-2 flex-wrap">
                    <CCBadge tone={c.status === 'completed' ? 'good' : c.status === 'failed' ? 'danger' : 'honey'}>
                      {c.status === 'completed' ? 'PLAN READY' : c.status === 'failed' ? 'FAILED' : 'PLANNING…'}
                    </CCBadge>
                    <span className="text-sm font-medium">{c.title.replace('Business plan: ', '')}</span>
                    <span className="text-[11px] text-muted ml-auto">{new Date(c.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </summary>
                  {plan
                    ? <div className="mt-3 border-t border-beige pt-3"><AgentReport text={plan} /></div>
                    : <p className="text-xs text-muted mt-3">{c.status === 'completed' ? c.result_summary : 'The Chief of Staff is drafting — refresh in a couple of minutes. Agent tasks are seeded automatically when the plan lands.'}</p>}
                  {c.status === 'completed' && <Link href={`/command-centre/commands/${c.id}`} className="text-xs text-honey hover:underline mt-2 inline-block">Open full record →</Link>}
                </details>
              );
            })}
          </div>
        )}
      </Section>

      {/* Module shortcuts */}
      <Section title="Module Shortcuts">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MODULE_SHORTCUTS.map((m) =>
            m.live ? (
              <Link key={m.label} href={m.href!} className="card p-4 ring-1 ring-honey/40 hover:shadow-md transition flex flex-col justify-between">
                <div className="font-medium text-sm">{m.label}</div>
                <div className="text-[11px] uppercase tracking-wide text-emerald-700 mt-2 font-semibold">Open Production Portal →</div>
              </Link>
            ) : (
              <div key={m.label} className="card p-4 opacity-70 flex flex-col justify-between">
                <div className="font-medium text-sm">{m.label}</div>
                <div className="text-[11px] uppercase tracking-wide text-muted mt-2">Planned</div>
              </div>
            ),
          )}
        </div>
      </Section>
    </>
  );
}
