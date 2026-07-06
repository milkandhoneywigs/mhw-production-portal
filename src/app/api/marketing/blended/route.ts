import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// Blended-performance writer. Two writers feed it (cloud revenue sync +
// the marketing agent's outlet pull), so it MERGES into the period row —
// fields absent from a post never blank fields another writer set.
// True blended MER = (premium revenue + outlet revenue) / total ad spend,
// recomputed automatically whenever the parts are present.

const FIELDS = ['total_ad_spend', 'blended_revenue', 'mer', 'google_spend', 'google_roas', 'meta_spend', 'meta_roas', 'attributed_revenue', 'email_revenue', 'notes',
  'premium_revenue', 'outlet_revenue', 'outlet_orders', 'premium_mer', 'outlet_mer'] as const;
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

    // Merge over the existing period row so independent writers compose.
    const { data: existing } = await supabase.from('mkt_blended_performance')
      .select('*').eq('period_label', period).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const merged: Record<string, any> = { ...(existing ?? {}), ...payload };
    delete merged.id; delete merged.created_at;

    // Recompute the true blend whenever the parts exist. premium_revenue falls
    // back to the GA4 site revenue the sync posts as blended_revenue.
    const premium = merged.premium_revenue ?? merged.blended_revenue;
    const spend = merged.total_ad_spend;
    if (premium != null && merged.outlet_revenue != null) {
      merged.premium_revenue = premium;
      merged.blended_revenue = Number(premium) + Number(merged.outlet_revenue);
    }
    if (spend) {
      if (merged.blended_revenue != null) merged.mer = Number((Number(merged.blended_revenue) / Number(spend)).toFixed(2));
      if (merged.premium_revenue != null) merged.premium_mer = Number((Number(merged.premium_revenue) / Number(spend)).toFixed(2));
    }

    await supabase.from('mkt_blended_performance').delete().eq('period_label', period);
    const { error } = await supabase.from('mkt_blended_performance').insert({
      ...merged,
      period_label: period,
      period_start: new Date(Date.now() - (period === 'last_7_days' ? 7 : 30) * 86400000).toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
    });
    out.push({ period, ok: !error, error: error?.message });
  }
  return NextResponse.json({ ok: true, results: out });
}
