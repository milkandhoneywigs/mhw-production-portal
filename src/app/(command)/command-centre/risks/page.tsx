import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { RiskActions } from '@/components/command/ActionButtons';
import { riskTone, money, MODULE_LABEL, type OwnerRisk } from '@/lib/command-centre/cc';

export const dynamic = 'force-dynamic';

export default async function RisksPage() {
  await requireAdmin();
  const sb = createClient();
  const { data } = await sb.from('owner_risks').select('*').order('created_at', { ascending: false });
  const R = (data ?? []) as OwnerRisk[];
  const open = R.filter((r) => r.status === 'open' || r.status === 'acknowledged');
  const closed = R.filter((r) => r.status === 'resolved' || r.status === 'dismissed');

  return (
    <>
      <PageHeader title="Risks" subtitle={`Owner risk centre — ${open.length} open`} />

      {open.length === 0 ? <EmptyState>No open risks.</EmptyState> : (
        <div className="space-y-3">
          {open.sort((a, b) => (b.risk_level === 'critical' ? 1 : 0) - (a.risk_level === 'critical' ? 1 : 0)).map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CCBadge tone={riskTone(r.risk_level)}>{r.risk_level} risk</CCBadge>
                    <span className="font-medium">{r.title}</span>
                    {r.status === 'acknowledged' && <CCBadge tone="info">acknowledged</CCBadge>}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{MODULE_LABEL[r.source_module]}</div>
                  {r.description && <p className="text-sm mt-2">{r.description}</p>}
                  {r.financial_impact != null && <p className="text-sm mt-1 font-medium">Financial impact: {money(r.financial_impact, r.currency ?? 'AUD')}</p>}
                </div>
                <div className="shrink-0"><RiskActions id={r.id} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mt-8 mb-3">Resolved / dismissed</h2>
          <div className="card divide-y divide-beige">
            {closed.map((r) => (
              <div key={r.id} className="p-3 flex items-center justify-between"><span className="text-sm">{r.title}</span><CCBadge tone="neutral">{r.status}</CCBadge></div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
