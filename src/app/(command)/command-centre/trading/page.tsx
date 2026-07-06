import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { TradingLive } from '@/components/command/TradingLive';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// TRADING — the score-5 live board. Data contract owned by the owner's bot:
// score5_signals (realtime inserts) → score5_outcomes (counterfactuals) →
// manual_trades (wallet-watch fills). Display-only; firewalled from business.
// -----------------------------------------------------------------------------

const n = (v: any) => (v == null ? null : Number(v));
const kUsd = (v: any) => (v == null ? '—' : `$${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : Number(v).toFixed(0)}`);
const sol = (v: any) => (v == null ? '—' : `${Number(v).toFixed(2)} ◎`);
const mult = (peak: any, entry: any) => (peak == null || !entry ? null : Number(peak) / Number(entry));
const fmtX = (m: number | null) => (m == null ? '—' : `${m >= 10 ? m.toFixed(0) : m.toFixed(1)}x`);
const ago = (v: string | null) => {
  if (!v) return '';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

export default async function TradingPage() {
  await requireAdmin();
  const sb = createClient();
  const [{ data: signals }, { data: outcomes }, { data: trades }] = await Promise.all([
    sb.from('score5_signals').select('*').order('created_at', { ascending: false }).limit(60),
    sb.from('score5_outcomes').select('*'),
    sb.from('manual_trades').select('*').order('entry_ts', { ascending: false }),
  ]);
  const S = (signals ?? []) as any[];
  const O = new Map(((outcomes ?? []) as any[]).map((o) => [o.signal_id, o]));
  const T = (trades ?? []) as any[];
  const tFor = (sid: string, mint: string) => T.find((t) => t.signal_id === sid || (t.mint && t.mint === mint));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todaySignals = S.filter((s) => new Date(s.created_at) >= today);
  const withOutcome = S.map((s) => O.get(s.id)).filter(Boolean) as any[];
  const monsters = withOutcome.filter((o) => Number(o.ath_multiple ?? 0) >= 10).length;
  const died = withOutcome.filter((o) => o.died).length;
  const openTrades = T.filter((t) => t.status === 'open');
  const pnlSol = T.reduce((s, t) => s + Number(t.pnl_sol ?? 0), 0);

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <PageHeader title="Trading — Score-5 Live Board"
          subtitle="Signals the bot shares, the instant they fire — with what happened next. Display-only." />
        <div className="ml-auto -mt-4"><TradingLive /></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="card p-4"><div className="text-2xl font-semibold tabular-nums">{todaySignals.length}</div><div className="text-sm text-muted">Signals today</div></div>
        <div className="card p-4"><div className="text-2xl font-semibold tabular-nums">{monsters}<span className="text-sm text-muted">/{withOutcome.length}</span></div><div className="text-sm text-muted">≥10x (tracked)</div></div>
        <div className="card p-4"><div className="text-2xl font-semibold tabular-nums">{withOutcome.length ? Math.round((died / withOutcome.length) * 100) : 0}%</div><div className="text-sm text-muted">Died</div></div>
        <div className="card p-4"><div className="text-2xl font-semibold tabular-nums">{openTrades.length}</div><div className="text-sm text-muted">Open wallet-watch trades</div></div>
        <div className="card p-4"><div className={`text-2xl font-semibold tabular-nums ${pnlSol > 0 ? 'text-emerald-700' : pnlSol < 0 ? 'text-red-600' : ''}`}>{sol(pnlSol)}</div><div className="text-sm text-muted">Wallet-watch P&L</div></div>
      </div>

      <Section title="Signal Feed">
        {S.length === 0 ? <EmptyState>Waiting for the first score-5. The board updates the second the bot inserts.</EmptyState> : (
          <div className="space-y-3">
            {S.map((s) => {
              const o = O.get(s.id);
              const t = tFor(s.id, s.mint);
              const m = s.metrics ?? {};
              const entry = n(s.entry_mcap_usd) ?? n(s.entry_mcap_sol);
              const fresh = Date.now() - new Date(s.created_at).getTime() < 30 * 60000;
              return (
                <div key={s.id} className={`card p-4 ${fresh ? 'ring-1 ring-honey/60' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {fresh && <span className="w-2 h-2 rounded-full bg-honey animate-pulse" />}
                    {/* Coin name IS the click-through; explicit button as backup. URL derived
                        from mint whenever the bot doesn't send pumpfun_url. */}
                    <a href={s.pumpfun_url || `https://pump.fun/coin/${s.mint}`} target="_blank" rel="noopener noreferrer"
                      className="text-base font-semibold hover:text-honey hover:underline">
                      {s.symbol ?? `${s.mint?.slice(0, 8)}…`}
                    </a>
                    <CCBadge tone="honey">SCORE {s.score ?? 5}</CCBadge>
                    <span className="text-xs text-muted">flagged @ {s.age_at_flag_s != null ? `${Math.round(s.age_at_flag_s)}s` : '—'} · entry {kUsd(s.entry_mcap_usd)} ({sol(s.entry_mcap_sol)})</span>
                    <a href={s.pumpfun_url || `https://pump.fun/coin/${s.mint}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs rounded-full bg-ink text-cream px-2.5 py-1 hover:bg-ink/85">pump.fun ↗</a>
                    <span className="text-[11px] text-muted ml-auto">{ago(s.created_at)}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-2 text-[11px]">
                    {m.absorption_band != null && <span className="rounded bg-sand px-1.5 py-0.5">abs: {m.absorption_band}</span>}
                    {m.bundle_pct != null && <span className={`rounded px-1.5 py-0.5 ${Number(m.bundle_pct) > 30 ? 'bg-red-50 text-red-700' : 'bg-sand'}`}>bundle {Number(m.bundle_pct).toFixed(0)}%</span>}
                    {m.n_coord_wallets != null && <span className="rounded bg-sand px-1.5 py-0.5">coord {m.n_coord_wallets}</span>}
                    {m.real_holders != null && <span className="rounded bg-sand px-1.5 py-0.5">holders {m.real_holders}</span>}
                    {m.bsr != null && <span className="rounded bg-sand px-1.5 py-0.5">bsr {Number(m.bsr).toFixed(2)}</span>}
                    {m.net != null && <span className="rounded bg-sand px-1.5 py-0.5">net {Number(m.net).toFixed(1)}</span>}
                    {m.ntr != null && <span className="rounded bg-sand px-1.5 py-0.5">ntr {Number(m.ntr).toFixed(2)}</span>}
                  </div>
                  {o && (
                    <div className="flex items-center gap-3 flex-wrap mt-2.5 text-sm border-t border-beige/70 pt-2">
                      <span className="text-[11px] uppercase tracking-wide text-muted">outcome</span>
                      <span className="tabular-nums text-xs">5m {fmtX(mult(o.mcap_5m, entry))} · 30m {fmtX(mult(o.mcap_30m, entry))} · 1h {fmtX(mult(o.mcap_1h, entry))} · peak {kUsd(o.peak_mcap)}</span>
                      <CCBadge tone={Number(o.ath_multiple ?? 0) >= 10 ? 'good' : Number(o.ath_multiple ?? 0) >= 2 ? 'honey' : 'neutral'}>ATH {fmtX(n(o.ath_multiple))}</CCBadge>
                      {o.died && <CCBadge tone="danger">DIED</CCBadge>}
                    </div>
                  )}
                  {t && (
                    <div className="flex items-center gap-3 flex-wrap mt-2 text-sm bg-cream/70 rounded-lg px-3 py-2">
                      <span className="text-[11px] uppercase tracking-wide text-muted">wallet-watch</span>
                      <span className="text-xs tabular-nums">in {sol(t.entry_sol)} @ {kUsd(t.entry_mcap)}{t.exit_ts ? ` → out @ ${kUsd(t.exit_mcap)}` : ''}</span>
                      <CCBadge tone={t.status === 'open' ? 'honey' : Number(t.pnl_sol ?? 0) >= 0 ? 'good' : 'danger'}>
                        {t.status === 'open' ? 'OPEN' : `${Number(t.pnl_sol ?? 0) >= 0 ? '+' : ''}${Number(t.pnl_sol ?? 0).toFixed(2)} ◎ (${t.pnl_pct != null ? `${Number(t.pnl_pct).toFixed(0)}%` : '—'})`}
                      </CCBadge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
