import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { CCBadge } from '@/components/command/CCBadge';
import { TradingLive } from '@/components/command/TradingLive';
import { SignalAnnotate } from '@/components/command/SignalAnnotate';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// TRADING — score-5 live board. Contract owned by the bot:
// score5_research (confidence tiers) → gauges at top;
// score5_signals (realtime) + owner annotations → cards with alpha wallets;
// score5_outcomes (PeakX live, died→ABANDON) + manual_trades (wallet-watch P&L).
// -----------------------------------------------------------------------------

const n = (v: any) => (v == null ? null : Number(v));
const kUsd = (v: any) => (v == null ? '—' : `$${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : Number(v).toFixed(0)}`);
const sol = (v: any) => (v == null ? '—' : `${Number(v).toFixed(2)} ◎`);
const mult = (peak: any, entry: any) => (peak == null || !entry ? null : Number(peak) / Number(entry));
const fmtX = (m: any) => (m == null ? '—' : `${Number(m) >= 10 ? Number(m).toFixed(0) : Number(m).toFixed(1)}x`);
const pct = (v: any) => (v == null ? '—' : `${(Number(v) * 100).toFixed(Number(v) < 0.1 ? 1 : 0)}%`);
const ago = (v: string | null) => {
  if (!v) return '';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 90) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

// Conic-gradient donut gauge for a research tier row.
function Gauge({ row }: { row: any }) {
  const conf = Math.max(0, Math.min(1, Number(row.confidence ?? 0)));
  const reject = row.tier === 0;
  const colour = reject ? '#dc2626' : conf >= 0.5 ? '#059669' : conf >= 0.2 ? '#C9A15C' : '#8a8378';
  const chips: string[] = Array.isArray(row.top_metrics)
    ? row.top_metrics.map((c: any) => String(typeof c === 'object' ? Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' ') : c))
    : row.top_metrics && typeof row.top_metrics === 'object'
      ? Object.entries(row.top_metrics).map(([k, v]) => `${k}: ${typeof v === 'number' ? Number(v).toFixed(2) : v}`)
      : [];
  return (
    <div className={`card p-4 ${reject ? 'ring-1 ring-red-200' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-16 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${colour} ${conf * 360}deg, #E9DFCE 0deg)` }}>
          <div className="absolute inset-1.5 rounded-full bg-white flex items-center justify-center">
            <span className="text-sm font-bold tabular-nums" style={{ color: colour }}>{pct(row.confidence)}</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{row.label ?? (reject ? 'Reject signature' : `PeakX ${row.tier}×`)}</div>
          <div className="text-[11px] text-muted">base {pct(row.base_rate)} · lift {row.lift != null ? `${Number(row.lift).toFixed(1)}×` : '—'} · AUC {row.auc != null ? Number(row.auc).toFixed(2) : '—'} · n={row.n_coins ?? '—'}</div>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {chips.slice(0, 5).map((c, i) => <span key={i} className="text-[10px] rounded bg-sand px-1.5 py-0.5">{c}</span>)}
        </div>
      )}
    </div>
  );
}

export default async function TradingPage({ searchParams }: { searchParams: { min?: string; died?: string; call?: string; sort?: string } }) {
  await requireAdmin();
  const sb = createClient();
  const filtered = !!(searchParams.min || searchParams.died || searchParams.call);
  const [{ data: research }, { data: signals }, { data: outcomes }, { data: trades }] = await Promise.all([
    sb.from('score5_research').select('*').order('tier'),
    // fetch deeper history when a filter is active so "the 5x club" spans the whole record
    sb.from('score5_signals').select('*').order('created_at', { ascending: false }).limit(filtered ? 400 : 60),
    sb.from('score5_outcomes').select('*'),
    sb.from('manual_trades').select('*').order('entry_ts', { ascending: false }),
  ]);
  const R = (research ?? []) as any[];
  let S = (signals ?? []) as any[];
  const O = new Map(((outcomes ?? []) as any[]).map((o) => [o.signal_id, o]));

  // Filters: minimum PeakX, died-only, my call. Sort: newest (default) or PeakX.
  const min = searchParams.min ? Number(searchParams.min) : null;
  if (min) S = S.filter((s) => Number(O.get(s.id)?.ath_multiple ?? 0) >= min);
  if (searchParams.died === '1') S = S.filter((s) => O.get(s.id)?.died);
  if (searchParams.call === 'yes' || searchParams.call === 'no') S = S.filter((s) => s.would_enter === searchParams.call);
  if (searchParams.sort === 'peakx') S = [...S].sort((a, b) => Number(O.get(b.id)?.ath_multiple ?? 0) - Number(O.get(a.id)?.ath_multiple ?? 0));
  const T = (trades ?? []) as any[];
  const tFor = (sid: string, mint: string) => T.find((t) => t.signal_id === sid || (t.mint && t.mint === mint));

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todaySignals = S.filter((s) => new Date(s.created_at) >= today);
  const openTrades = T.filter((t) => t.status === 'open');
  const pnlSol = T.reduce((s, t) => s + Number(t.pnl_sol ?? 0), 0);

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <PageHeader title="Trading — Score-5 Live Board"
          subtitle="Signals as they fire, confidence tiers from the research engine, your judgement captured per signal." />
        <div className="ml-auto -mt-4"><TradingLive /></div>
      </div>

      {/* Confidence charts — the research engine's current read, live-updated */}
      {R.length > 0 && (
        <Section title="Confidence Tiers (research engine)">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {R.map((row) => <Gauge key={row.tier} row={row} />)}
          </div>
        </Section>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4"><div className="text-2xl font-semibold tabular-nums">{todaySignals.length}</div><div className="text-sm text-muted">Signals today</div></div>
        <div className="card p-4"><div className="text-2xl font-semibold tabular-nums">{openTrades.length}</div><div className="text-sm text-muted">Open wallet-watch trades</div></div>
        <div className="card p-4"><div className={`text-2xl font-semibold tabular-nums ${pnlSol > 0 ? 'text-emerald-700' : pnlSol < 0 ? 'text-red-600' : ''}`}>{sol(pnlSol)}</div><div className="text-sm text-muted">Wallet-watch P&L</div></div>
      </div>

      {/* Filter / sort bar — isolate the 5x club, deaths, or your own calls */}
      <div className="flex items-center gap-2 flex-wrap mb-4 text-xs">
        <span className="text-muted">Filter:</span>
        {[
          { label: 'All', href: '/command-centre/trading' },
          { label: '≥2x', href: '?min=2' }, { label: '≥3x', href: '?min=3' },
          { label: '≥5x', href: '?min=5' }, { label: '≥10x', href: '?min=10' },
          { label: 'Died', href: '?died=1' },
          { label: '✓ my yes', href: '?call=yes' }, { label: '✗ my no', href: '?call=no' },
        ].map((f) => {
          const active = (f.href === '/command-centre/trading' && !filtered && searchParams.sort !== 'peakx')
            || f.href === `?min=${searchParams.min}` || (f.href === '?died=1' && searchParams.died === '1')
            || f.href === `?call=${searchParams.call}`;
          return <a key={f.label} href={f.href} className={`rounded-full px-3 py-1 border ${active ? 'bg-ink text-cream border-ink' : 'border-beige hover:bg-sand'}`}>{f.label}</a>;
        })}
        <span className="text-muted ml-3">Sort:</span>
        <a href={`?${new URLSearchParams({ ...(searchParams.min ? { min: searchParams.min } : {}), ...(searchParams.died ? { died: searchParams.died } : {}), ...(searchParams.call ? { call: searchParams.call } : {}) }).toString()}`}
          className={`rounded-full px-3 py-1 border ${searchParams.sort !== 'peakx' ? 'bg-ink text-cream border-ink' : 'border-beige hover:bg-sand'}`}>Newest</a>
        <a href={`?${new URLSearchParams({ ...(searchParams.min ? { min: searchParams.min } : {}), ...(searchParams.died ? { died: searchParams.died } : {}), ...(searchParams.call ? { call: searchParams.call } : {}), sort: 'peakx' }).toString()}`}
          className={`rounded-full px-3 py-1 border ${searchParams.sort === 'peakx' ? 'bg-ink text-cream border-ink' : 'border-beige hover:bg-sand'}`}>Highest PeakX</a>
        {filtered && <span className="text-muted ml-2">{S.length} match{S.length === 1 ? '' : 'es'}</span>}
      </div>

      <Section title="Signal Feed">
        {S.length === 0 ? <EmptyState>Waiting for the first score-5 — the board updates the instant the bot inserts.</EmptyState> : (
          <div className="space-y-3">
            {S.map((s) => {
              const o = O.get(s.id);
              const t = tFor(s.id, s.mint);
              const m = s.metrics ?? {};
              const alpha: any[] = Array.isArray(m.alpha) ? m.alpha : [];
              const entry = n(s.entry_mcap_usd) ?? n(s.entry_mcap_sol);
              const fresh = Date.now() - new Date(s.created_at).getTime() < 30 * 60000;
              return (
                <div key={s.id} className={`card p-4 relative ${o?.died ? 'ring-1 ring-red-200' : fresh ? 'ring-1 ring-honey/60' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {fresh && !o?.died && <span className="w-2 h-2 rounded-full bg-honey animate-pulse" />}
                    <a href={s.pumpfun_url || `https://pump.fun/coin/${s.mint}`} target="_blank" rel="noopener noreferrer"
                      className="text-base font-semibold hover:text-honey hover:underline">
                      {s.symbol ?? `${s.mint?.slice(0, 8)}…`}
                    </a>
                    {m.name && <span className="text-xs text-muted">{m.name}</span>}
                    <CCBadge tone="honey">SCORE {s.score ?? 5}</CCBadge>
                    {o?.ath_multiple != null && (
                      <CCBadge tone={Number(o.ath_multiple) >= 10 ? 'good' : Number(o.ath_multiple) >= 2 ? 'honey' : 'neutral'}>
                        PeakX {fmtX(o.ath_multiple)}
                      </CCBadge>
                    )}
                    {o?.died && <CCBadge tone="danger">ABANDON</CCBadge>}
                    <a href={s.pumpfun_url || `https://pump.fun/coin/${s.mint}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs rounded-full bg-ink text-cream px-2.5 py-1 hover:bg-ink/85">pump.fun ↗</a>
                    <SignalAnnotate id={s.id} current={s.would_enter} currentNotes={s.notes} />
                  </div>

                  {/* ALPHA — smart-money wallets, the headline signal */}
                  {alpha.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">α smart money ×{m.alpha_count ?? alpha.length}</span>
                      {alpha.slice(0, 4).map((w: any, i: number) => (
                        <span key={i} className="text-[10px] rounded bg-emerald-50/70 border border-emerald-100 px-1.5 py-0.5 tabular-nums">
                          {String(w.w ?? '').slice(0, 4)}… cov {w.cov ?? '—'} · hit {w.hit != null ? `${Math.round(Number(w.hit) * 100)}%` : '—'} · best {w.best != null ? `${Number(w.best).toFixed(0)}x` : '—'}
                        </span>
                      ))}
                      {alpha.length > 4 && <span className="text-[10px] text-muted">+{alpha.length - 4} more</span>}
                    </div>
                  )}

                  <div className="flex gap-1.5 flex-wrap mt-2 text-[11px]">
                    <span className="text-xs text-muted mr-1">flagged @ {s.age_at_flag_s != null ? `${Math.round(s.age_at_flag_s)}s` : '—'} · entry {kUsd(s.entry_mcap_usd)} ({sol(s.entry_mcap_sol)})</span>
                    {m.bundle_pct != null && <span className={`rounded px-1.5 py-0.5 ${Number(m.bundle_pct) > 30 ? 'bg-red-50 text-red-700' : 'bg-sand'}`}>bundle {Number(m.bundle_pct).toFixed(0)}%</span>}
                    {m.real_holders != null && <span className="rounded bg-sand px-1.5 py-0.5">holders {m.real_holders}</span>}
                    {m.uniq_buyers != null && <span className="rounded bg-sand px-1.5 py-0.5">buyers {m.uniq_buyers}</span>}
                    {m.bsr != null && <span className="rounded bg-sand px-1.5 py-0.5">bsr {Number(m.bsr).toFixed(2)}</span>}
                    {m.net != null && <span className="rounded bg-sand px-1.5 py-0.5">net {Number(m.net).toFixed(1)}</span>}
                    {m.ntr != null && <span className="rounded bg-sand px-1.5 py-0.5">ntr {Number(m.ntr).toFixed(2)}</span>}
                    <span className="text-[11px] text-muted ml-auto">{ago(s.created_at)}</span>
                  </div>

                  {o && (
                    <div className="flex items-center gap-3 flex-wrap mt-2.5 text-xs border-t border-beige/70 pt-2 tabular-nums">
                      <span className="text-[11px] uppercase tracking-wide text-muted">outcome</span>
                      <span>5m {fmtX(mult(o.mcap_5m, entry))} · 30m {fmtX(mult(o.mcap_30m, entry))} · 1h {fmtX(mult(o.mcap_1h, entry))} · peak {kUsd(o.peak_mcap)}</span>
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
                  {s.notes && <div className="text-[11px] text-muted mt-2 italic">📝 {s.notes}</div>}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
