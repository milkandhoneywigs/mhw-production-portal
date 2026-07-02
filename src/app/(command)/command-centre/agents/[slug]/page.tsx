import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { CommandComposer } from '@/components/command/CommandComposer';
import { agentStatusTone, riskTone, priorityTone, money, type Agent, type AgentUpdate, type OwnerApproval, type OwnerRisk } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

export default async function AgentDetail({ params }: { params: { slug: string } }) {
  await requireAdmin();
  const sb = createClient();
  const { data: agent } = await sb.from('agents').select('*').eq('slug', params.slug).single();
  if (!agent) notFound();
  const a = agent as Agent;

  const [{ data: updates }, { data: approvals }, { data: risks }, { data: caps }, { data: tools }, { data: plan }] = await Promise.all([
    sb.from('agent_updates').select('*').eq('agent_id', a.id).order('created_at', { ascending: false }).limit(8),
    sb.from('owner_approvals').select('*').eq('agent_id', a.id).eq('status', 'pending'),
    sb.from('owner_risks').select('*').eq('agent_id', a.id).in('status', ['open', 'acknowledged']),
    sb.from('agent_capabilities').select('*').eq('agent_id', a.id).order('created_at'),
    sb.from('agent_tool_connections').select('*').eq('agent_id', a.id).order('created_at'),
    sb.from('agent_plans').select('*').eq('agent_id', a.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const UP = (updates ?? []) as AgentUpdate[];
  const AP = (approvals ?? []) as OwnerApproval[];
  const RK = (risks ?? []) as OwnerRisk[];
  const CAP = (caps ?? []) as { id: string; capability_name: string; description: string | null; permission_level: string; active: boolean }[];
  const TL = (tools ?? []) as { id: string; tool_name: string; connection_type: string; status: string }[];
  const PL = (plan ?? null) as { title: string; objective: string | null; current_focus: string | null; next_actions: string[]; status: string } | null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Link href="/command-centre/agents" className="text-xs text-honey hover:underline">← Agents</Link>
        <h1 className="text-xl font-semibold">{a.name}</h1>
        <CCBadge tone={agentStatusTone(a.status)}>{a.status}</CCBadge>
        <CCBadge tone={riskTone(a.risk_level)}>{a.risk_level} risk</CCBadge>
        {a.module_link && <Link href={a.module_link} className="btn-secondary text-xs ml-auto">Open module →</Link>}
      </div>
      <p className="text-sm text-muted mb-6">{a.business_area}{a.description ? ` — ${a.description}` : ''}</p>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title={`Command ${a.name}`}>
            <div className="card p-5">
              {a.status !== 'active' && <div className="text-xs text-amber-700 mb-3">This agent is <b>{a.status}</b> — commands will queue but won't run until it's active.</div>}
              <CommandComposer agents={[{ id: a.id, name: a.name, status: a.status }]} placeholder={`Instruction for ${a.name}…`} />
            </div>
          </Section>

          <Section title="Latest Updates">
            {UP.length === 0 ? <EmptyState>No updates.</EmptyState> : (
              <div className="card divide-y divide-beige">
                {UP.map((u) => (
                  <div key={u.id} className="p-3">
                    <div className="flex items-center gap-2"><CCBadge tone={u.update_type === 'warning' ? 'warn' : u.update_type === 'error' ? 'danger' : u.update_type === 'success' ? 'good' : u.update_type === 'recommendation' ? 'honey' : 'info'}>{u.update_type}</CCBadge><span className="text-sm font-medium">{u.title}</span></div>
                    {u.summary && <p className="text-xs text-muted mt-1">{u.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {PL && (
            <Section title="Current Plan">
              <div className="card p-5">
                <div className="flex items-center justify-between"><span className="font-medium">{PL.title}</span><CCBadge tone={PL.status === 'active' ? 'good' : 'neutral'}>{PL.status}</CCBadge></div>
                {PL.objective && <p className="text-sm mt-2"><span className="text-muted">Objective:</span> {PL.objective}</p>}
                {PL.current_focus && <p className="text-sm mt-1"><span className="text-muted">Focus:</span> {PL.current_focus}</p>}
                {Array.isArray(PL.next_actions) && PL.next_actions.length > 0 && (
                  <ul className="text-sm mt-2 list-disc pl-5">{PL.next_actions.map((x, i) => <li key={i}>{x}</li>)}</ul>
                )}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Needs Approval">
            {AP.length === 0 ? <p className="text-sm text-muted">None.</p> : AP.map((x) => (
              <Link key={x.id} href="/command-centre/approvals" className="card p-3 block mb-2 hover:bg-cream/60">
                <div className="text-sm font-medium">{x.title}</div>
                <div className="flex items-center gap-2 mt-1"><CCBadge tone={priorityTone(x.priority)}>{x.priority}</CCBadge>{x.financial_impact != null && <span className="text-xs">{money(x.financial_impact, x.currency ?? 'AUD')}</span>}</div>
              </Link>
            ))}
          </Section>

          <Section title="Open Risks">
            {RK.length === 0 ? <p className="text-sm text-muted">None.</p> : RK.map((r) => (
              <Link key={r.id} href="/command-centre/risks" className="card p-3 block mb-2 hover:bg-cream/60">
                <div className="text-sm font-medium">{r.title}</div><CCBadge tone={riskTone(r.risk_level)}>{r.risk_level}</CCBadge>
              </Link>
            ))}
          </Section>

          <Section title="Capabilities">
            <div className="card p-4 space-y-2">
              {CAP.length === 0 ? <p className="text-sm text-muted">Not defined.</p> : CAP.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="flex items-center gap-2"><span className="font-medium">{c.capability_name}</span><CCBadge tone={c.permission_level === 'auto_action' ? 'danger' : c.permission_level === 'approval_required' ? 'warn' : c.permission_level === 'draft' ? 'honey' : 'neutral'}>{c.permission_level}</CCBadge></div>
                  {c.description && <p className="text-xs text-muted">{c.description}</p>}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tool Connections">
            <div className="card p-4 space-y-1">
              {TL.length === 0 ? <p className="text-sm text-muted">None.</p> : TL.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span>{t.tool_name}</span>
                  <CCBadge tone={t.status === 'connected' ? 'good' : t.status === 'error' ? 'danger' : t.status === 'disabled' ? 'neutral' : 'honey'}>{t.status}</CCBadge>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
