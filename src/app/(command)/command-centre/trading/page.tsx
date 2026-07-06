import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { AutoRefresh } from '@/components/command/AutoRefresh';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// TRADING — live ledger of trades the owner's bot terminal chooses to share.
// Completely separate from all business modules: display-only, no actions,
// nothing here can touch bots or funds. Auto-refreshes for live feel.
// -----------------------------------------------------------------------------

const money = (v: number | null) =>
  v == null ? '—' : `${v < 0 ? '-' : ''}$${Math.abs(Number(v)).toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;
const dt = (v: string) => new Date(v).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const ago = (v: string) => {
  const m = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

export default async function TradingPage({ searchParams }: { searchParams: { bot?: string } }) {
  await requireAdmin();
  const sb = createClient();

  let q = sb.from('trading_ledger').select('*').order('occurred_at', { ascending: false }).limit(100);
  if (searchParams.bot) q = q.eq('bot', searchParams.bot);
  const [{ data: events }, { data: allBots }] = await Promise.all([
    q,
    sb.from('trading_ledger').select('bot').order('bot'),
  ]);
  const E = (events ?? []) as any[];
  const bots = Array.from(new Set((allBots ?? []).map((b: any) => b.bot)));

  const open = E.filter((e) => e.status === 'open' && e.event_type !== 'note');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const closedToday = E.filter((e) => e.status === 'closed' && new Date(e.occurred_at) >= today);
  const pnlToday = closedToday.reduce((s, e) => s + Number(e.pnl_usd ?? 0), 0);
  const pnlAll = E.filter((e) => e.pnl_usd != null).reduce((s, e) => s + Number(e.pnl_usd), 0);
  const last = E[0];

  return (
    <>
      <AutoRefresh seconds={15} />
      <PageHeader title="Trading — Live Ledger"
        subtitle="Trades your bot terminal chooses to share, as they happen. Display-only — nothing here touches the bots." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="card p-4"><div className="text-2xl font-semibold tabular-nums">{open.length}</div><div className="text-sm text-muted">Open shared positions</div></div>
        <div className="card p-4"><div className={`text-2xl font-semibold tabular-nums ${pnlToday > 0 ? 'text-emerald-700' : pnlToday < 0 ? 'text-red-600' : ''}`}>{money(pnlToday)}</div><div className="text-sm text-muted">Realised P&L today ({closedToday.length} closes)</div></div>
        <div className="card p-4"><div className={`text-2xl font-semibold tabular-nums ${pnlAll > 0 ? 'text-emerald-700' : pnlAll < 0 ? 'text-red-600' : ''}`}>{money(pnlAll)}</div><div className="text-sm text-muted">Realised P&L (last 100 events)</div></div>
        <div className="card p-4"><div className="text-sm font-semibold mt-1">{last ? ago(last.occurred_at) : 'no events yet'}</div><div className="text-sm text-muted">Last event · refreshes every 15s</div></div>
      </div>

      {bots.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <a href="/command-centre/trading" className={`text-xs rounded-full px-3 py-1 border ${!searchParams.bot ? 'bg-ink text-cream border-ink' : 'border-beige hover:bg-sand'}`}>All bots</a>
          {bots.map((b) => (
            <a key={b} href={`?bot=${encodeURIComponent(b)}`} className={`text-xs rounded-full px-3 py-1 border ${searchParams.bot === b ? 'bg-ink text-cream border-ink' : 'border-beige hover:bg-sand'}`}>{b}</a>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <Section title={`Open Positions (${open.length})`}>
          <div className="card divide-y divide-beige">
            {open.map((e) => (
              <div key={e.id} className="p-3 flex items-center gap-3 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-honey animate-pulse shrink-0" />
                <CCBadge tone="honey">{e.bot}</CCBadge>
                <span className="text-sm font-semibold">{e.symbol ?? (e.mint ? `${e.mint.slice(0, 6)}…` : '—')}</span>
                {e.side && <CCBadge tone={e.side === 'buy' ? 'good' : 'danger'}>{e.side.toUpperCase()}</CCBadge>}
                <span className="text-sm tabular-nums">{money(e.usd_value)}</span>
                {e.reason && <span className="text-xs text-muted">{e.reason}</span>}
                <span className="text-[11px] text-muted ml-auto">{ago(e.occurred_at)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Live Feed">
        {E.length === 0 ? (
          <EmptyState>
            No shared trades yet. Point the bot terminal at the intake endpoint — the connection sheet is in
            ~/business-brain-adjacent docs the owner holds; events appear here the second they arrive.
          </EmptyState>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand/60 text-xs uppercase tracking-wide text-muted">
                <tr><th className="text-left px-3 py-2">Time</th><th className="text-left px-3 py-2">Bot</th><th className="text-left px-3 py-2">Coin</th><th className="text-left px-3 py-2">Event</th><th className="text-right px-3 py-2">Value</th><th className="text-right px-3 py-2">P&L</th><th className="text-left px-3 py-2">Note</th></tr>
              </thead>
              <tbody className="divide-y divide-beige/70">
                {E.map((e) => (
                  <tr key={e.id} className="hover:bg-cream/50">
                    <td className="px-3 py-2 text-xs text-muted whitespace-nowrap">{dt(e.occurred_at)}</td>
                    <td className="px-3 py-2"><CCBadge tone="neutral">{e.bot}</CCBadge></td>
                    <td className="px-3 py-2 font-medium">{e.symbol ?? (e.mint ? `${e.mint.slice(0, 8)}…` : '—')}</td>
                    <td className="px-3 py-2">
                      <CCBadge tone={e.event_type === 'close' ? (Number(e.pnl_usd ?? 0) >= 0 ? 'good' : 'danger') : e.side === 'buy' ? 'good' : e.side === 'sell' ? 'danger' : 'info'}>
                        {e.event_type === 'close' ? 'CLOSE' : (e.side ?? e.event_type).toUpperCase()}
                      </CCBadge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(e.usd_value)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${e.pnl_usd == null ? 'text-muted' : Number(e.pnl_usd) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{e.pnl_usd == null ? '—' : money(e.pnl_usd)}</td>
                    <td className="px-3 py-2 text-xs text-muted max-w-[260px] truncate">{e.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
