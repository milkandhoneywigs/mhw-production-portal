import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// Blended-performance writer for the daily sync routine: upserts the 7d/30d
// MER rows (Google + Meta spend vs website revenue). Whitelisted fields only;
// guarded by x-mhw-secret. Nothing else writable through here.

const FIELDS = ['total_ad_spend', 'blended_revenue', 'mer', 'google_spend', 'google_roas', 'meta_spend', 'meta_roas', 'attributed_revenue', 'email_revenue', 'notes'] as const;
const PERIODS = new Set(['last_7_days', 'last_30_days']);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-mhw-secret');
  if (!process.env.SHOPIFY_SYNC_SECRET || secret !== process.env.SHOPIFY_SYNC_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const supabase = createServiceClient();
  const out: any[] = [];
  for (const row of Array.isArray(body?.rows) ? body.rows.slice(0, 4) : []) {
    const period = String(row?.period_label ?? '');
    if (!PERIODS.has(period)) continue;
    const payload: Record<string, unknown> = {};
    for (const f of FIELDS) if (row[f] !== undefined && row[f] !== null) payload[f] = f === 'notes' ? String(row[f]) : Number(row[f]);
    if (!Object.keys(payload).length) continue;
    await supabase.from('mkt_blended_performance').delete().eq('period_label', period);
    const { error } = await supabase.from('mkt_blended_performance').insert({
      period_label: period,
      period_start: new Date(Date.now() - (period === 'last_7_days' ? 7 : 30) * 86400000).toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      ...payload,
    });
    out.push({ period, ok: !error, error: error?.message });
  }
  return NextResponse.json({ ok: true, results: out });
}
