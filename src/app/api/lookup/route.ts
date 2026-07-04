import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { stageOf, STAGE_LABELS, STAGE_NOTE, type OrderStatus } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Read-only order lookup for Claudia (CS bot) and other trusted internal tools.
//
//   GET /api/lookup?order=31312
//   GET /api/lookup?email=customer@example.com
//
// Returns ONLY customer-safe fields: order number, customer name, product,
// stage + ETA + overdue flag. NEVER exposes the supplier, pricing/invoices,
// internal notes, or risk. Guarded by the x-mhw-secret shared secret.
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-mhw-secret');
  if (!process.env.SHOPIFY_SYNC_SECRET || secret !== process.env.SHOPIFY_SYNC_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const orderNumber = url.searchParams.get('order')?.trim().replace(/^#/, '');
  const email = url.searchParams.get('email')?.trim().toLowerCase();
  if (!orderNumber && !email) {
    return NextResponse.json({ error: 'provide ?order= or ?email=' }, { status: 400 });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from('orders')
    .select(
      'order_number, status, order_type, customer_facing_product_name, date_ordered, expected_completion_date, production_complete_at, customer:customers(full_name, email), tracking(tracking_type, carrier, tracking_number, tracking_url, created_at)',
    )
    .order('created_at', { ascending: false })
    .limit(20);

  if (orderNumber) query = query.eq('order_number', orderNumber);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data ?? [];
  // Email filter is applied in-app (nested relation filter isn't reliable here).
  if (email) rows = rows.filter((o: any) => (o.customer?.email ?? '').toLowerCase() === email);

  const today = new Date();
  const results = rows.map((o: any) => {
    const stage = stageOf(o.status as OrderStatus);
    const eta = o.expected_completion_date as string | null;
    const overdue = !!eta && !o.production_complete_at && new Date(eta) < today;
    return {
      order_number: o.order_number,
      customer_name: o.customer?.full_name ?? null,
      product: o.customer_facing_product_name ?? null,
      order_type: o.order_type,
      status: o.status,
      stage,
      stage_label: STAGE_LABELS[stage],
      stage_note: STAGE_NOTE[stage],
      date_ordered: o.date_ordered ?? null,
      estimated_completion: eta,
      overdue,
      // Customer-facing tracking only (never supplier→showroom legs): lets
      // Claudia answer shipped-order WISMO with the number + link instead of
      // escalating. Carrier/number/url are already customer-safe by nature.
      tracking: (o.tracking ?? [])
        .filter((t: any) => t.tracking_type !== 'supplier_to_showroom' && t.tracking_number)
        .map((t: any) => ({
          carrier: t.carrier ?? null,
          tracking_number: t.tracking_number,
          tracking_url: t.tracking_url ?? null,
          uploaded_at: t.created_at,
        })),
    };
  });

  if (results.length === 0) {
    return NextResponse.json({ found: false, results: [] }, { status: 404 });
  }
  return NextResponse.json({ found: true, count: results.length, results });
}
