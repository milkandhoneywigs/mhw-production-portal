import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Trading ledger intake. The owner's trading bot terminal POSTs the trades it
// chooses to share; they appear live on /command-centre/trading.
// Auth: x-mhw-trading-secret header, checked against app_settings (DB-held so
// no env redeploys). This endpoint only ever writes to trading_ledger —
// completely separate from all business data.
//
//   POST /api/trading/ledger
//   { "bot": "monster-hunter", "event_type": "trade", "side": "buy",
//     "symbol": "COIN", "mint": "...", "qty": 123, "price": 0.0001,
//     "usd_value": 10.5, "pnl_usd": null, "status": "open",
//     "reason": "mcap>=200 & jump15>=1.08", "tx_sig": "...",
//     "occurred_at": "2026-07-06T12:00:00Z", "raw": {...} }
//   Arrays accepted too: [ {...}, {...} ]
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const secret = req.headers.get('x-mhw-trading-secret');
  const { data: expected } = await supabase.from('app_settings').select('value').eq('key', 'trading_intake_secret').single();
  if (!secret || !expected || secret !== expected.value) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  const items = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
  if (items.length === 0 || items.length > 100) return NextResponse.json({ error: '1-100 events per call' }, { status: 400 });

  const rows = items.map((e) => ({
    bot: String(e.bot ?? 'unknown').slice(0, 60),
    event_type: ['trade', 'close', 'update', 'note'].includes(String(e.event_type)) ? e.event_type : 'trade',
    side: e.side === 'buy' || e.side === 'sell' ? e.side : null,
    symbol: e.symbol != null ? String(e.symbol).slice(0, 60) : null,
    mint: e.mint != null ? String(e.mint).slice(0, 100) : null,
    qty: e.qty ?? null,
    price: e.price ?? null,
    usd_value: e.usd_value ?? null,
    pnl_usd: e.pnl_usd ?? null,
    status: ['open', 'closed', 'info'].includes(String(e.status)) ? e.status : 'open',
    reason: e.reason != null ? String(e.reason).slice(0, 500) : null,
    tx_sig: e.tx_sig != null ? String(e.tx_sig).slice(0, 120) : null,
    occurred_at: e.occurred_at ?? new Date().toISOString(),
    raw: e.raw ?? null,
  }));

  const { error } = await supabase.from('trading_ledger').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: rows.length });
}
