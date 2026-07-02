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

  const [{ data: agents }, { data: commands }, { data: approvals }, { data: risks }, { data: snap }, { data: updates }, { data: tasks }] = await Promise.all([
    sb.from('agents').select('*').order('created_at'),
    sb.from('agent_commands').select('id,title,agent_id,status,priority,command_type,created_at,completed_at,result_summary').order('created_at', { ascending: false }).limit(50),
    sb.from('owner_approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    sb.from('owner_risks').select('*').in('status', ['open', 'acknowledged']).order('created_at', { ascending: false }),
    sb.from('financial_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
    sb.from('agent_updates').select('*').order('created_at', { ascending: false }).limit(6),
    sb.from('business_tasks').select('*').in('status', ['todo', 'in_progress', 'blocked']).order('created_at', { ascending: false }).limit(8),
  ]);

  const A = (agents ?? []) as Agent[];
  const C = (commands ?? []) as AgentCommand[];
  const AP = (approvals ?? []) as OwnerApproval[];
  const RK = (risks ?? []) as OwnerRisk[];
  const UP = (updates ?? []) as AgentUpdate[];
  const TK = (tasks ?? []) as BusinessTask[];
  const F = (snap ?? null) as FinancialSnapshot | null;
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

      {/* Owner attention cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <Metric label="Pending approvals" value={AP.length} tone={AP.length ? 'warn' : 'neutral'} href="/command-centre/approvals" />
        <Metric label="High-risk issues" value={highRisk} tone={highRisk ? 'danger' : 'neutral'} href="/command-centre/risks" />
        <Metric label="Queued commands" value={queued} tone={queued ? 'honey' : 'neutral'} href="/command-centre/commands?status=queued" />
        <Metric label="Running commands" value={running} tone={running ? 'good' : 'neutral'} href="/command-centre/commands?status=running" />
        <Metric label="Completed today" value={completedToday} tone="good" href="/command-centre/commands?status=completed" />
        <Metric label="Failed commands" value={failed} tone={failed ? 'danger' : 'neutral'} href="/command-centre/commands?status=failed" />
        <Metric label="Supplier payments due" value={money(F?.supplier_payments_due)} tone={F?.supplier_payments_due ? 'warn' : 'neutral'} href="/command-centre/financials" />
        <Metric label="Balance payments due" value={money(F?.balance_payments_due)} tone={F?.balance_payments_due ? 'danger' : 'neutral'} href="/command-centre/financials" />
        <Metric label="Orders blocked by payment" value={F?.orders_blocked_by_payment ?? 0} tone={(F?.orders_blocked_by_payment ?? 0) ? 'danger' : 'neutral'} href="/production" />
        <Metric label="Month-to-date revenue" value={money(F?.month_revenue)} tone="honey" href="/command-centre/financials" />
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

      {/* Financial snapshot */}
      <Section title="Financial Snapshot" action={<Link href="/command-centre/financials" className="text-xs text-honey hover:underline">Full financials →</Link>}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Today's revenue" value={money(F?.today_revenue)} />
          <Metric label="This week" value={money(F?.week_revenue)} />
          <Metric label="This month" value={money(F?.month_revenue)} tone="honey" />
          <Metric label="Net sales (MTD)" value={money(F?.net_sales)} />
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
