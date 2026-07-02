import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Revenue snapshot writer for the daily revenue-sync cloud routine.
//
// The routine pulls GA4 revenue via Supermetrics and POSTs it here. This keeps
// the Supabase SERVICE KEY in Vercel env (never in the cloud routine) — the
// routine only carries the low-privilege shared secret, which can do nothing but
// upsert today's revenue figures.
//
// Only revenue fields are written; supplier-liability / production fields are
// computed live by the portal and are never touched here.
// Guard: x-mhw-secret header must equal SHOPIFY_SYNC_SECRET.
// -----------------------------------------------------------------------------

const REVENUE_FIELDS = ['today_revenue', 'week_revenue', 'month_revenue', 'online_revenue', 'instore_revenue', 'outlet_revenue', 'refunds', 'net_sales', 'notes'] as const;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-mhw-secret');
  if (!process.env.SHOPIFY_SYNC_SECRET || secret !== process.env.SHOPIFY_SYNC_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Whitelist: only accept known revenue fields (numbers, or notes string).
  const payload: Record<string, unknown> = {};
  for (const f of REVENUE_FIELDS) {
    if (body[f] === undefined || body[f] === null) continue;
    payload[f] = f === 'notes' ? String(body[f]) : Number(body[f]);
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Optional daily series upsert: body.daily = [{date, revenue, transactions, sessions}].
  // Feeds the analytics charts (business_metrics daily_online_* series).
  let dailyUpserted = 0;
  if (Array.isArray(body.daily)) {
    for (const d of body.daily.slice(0, 62)) {
      const date = String((d as any)?.date ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const ts = `${date}T00:00:00Z`;
      const rows = [
        { metric_name: 'daily_online_revenue', metric_value: Number((d as any).revenue ?? 0), currency: 'AUD' },
        { metric_name: 'daily_online_transactions', metric_value: Number((d as any).transactions ?? 0), currency: null },
        { metric_name: 'daily_online_sessions', metric_value: Number((d as any).sessions ?? 0), currency: null },
      ];
      for (const r of rows) {
        await supabase.from('business_metrics').delete().eq('metric_name', r.metric_name).eq('recorded_at', ts);
        await supabase.from('business_metrics').insert({
          ...r, metric_category: 'revenue', period: 'custom', source: 'manual', recorded_at: ts,
        });
      }
      dailyUpserted++;
    }
  }

  if (Object.keys(payload).length === 0) {
    if (dailyUpserted > 0) return NextResponse.json({ ok: true, action: 'daily_only', daily_upserted: dailyUpserted });
    return NextResponse.json({ error: 'no revenue fields provided' }, { status: 400 });
  }

  // Upsert today's row: update if it exists, otherwise insert.
  const { data: existing } = await supabase.from('financial_snapshots').select('id').eq('snapshot_date', today).maybeSingle();
  if (existing) {
    const { error } = await supabase.from('financial_snapshots').update(payload).eq('snapshot_date', today);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'updated', snapshot_date: today, daily_upserted: dailyUpserted });
  }
  const { error } = await supabase.from('financial_snapshots').insert({ snapshot_date: today, ...payload });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: 'inserted', snapshot_date: today, daily_upserted: dailyUpserted });
}
