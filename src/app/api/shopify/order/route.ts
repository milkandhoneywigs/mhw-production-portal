import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { classifyOrder } from '@/lib/business/classify';
import { calculateSupplierLength } from '@/lib/business/length';
import type { OrderStatus } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Shopify -> Portal auto-sync (NEW ORDERS ONLY).
//
// Make.com watches Shopify for NEW orders and POSTs the raw order JSON here.
// This endpoint does the smart part: it detects wig line items, applies the
// Milk & Honey production rules, and creates the customer + order. It DEDUPES on
// order_number, so a retried/duplicate webhook never creates a second order and
// it can never backdate historical orders (Make only fires on new ones).
//
// Auth: a shared secret in the `x-mhw-secret` header must match SHOPIFY_SYNC_SECRET.
// -----------------------------------------------------------------------------

// Order date + 40 business days (Mon–Fri) -> the ETA shown on each order.
function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

const clean = (v: unknown): string | null => {
  const s = (v ?? '').toString().trim();
  return s.length ? s : null;
};

// Pull a usable length ("18") from a list of candidate strings, using the same
// parser the rest of the app uses. Returns the first candidate that parses to a
// single clean inch value; otherwise returns the first non-empty candidate so
// classifyOrder can flag it needs_review (never guesses).
function extractLength(candidates: (string | null)[]): string | null {
  const nonEmpty = candidates.filter((c): c is string => !!c && c.trim().length > 0);
  for (const c of nonEmpty) {
    if (!calculateSupplierLength(c).needsReview) return c;
  }
  return nonEmpty[0] ?? null;
}

export async function POST(req: NextRequest) {
  // --- auth ---
  const secret = req.headers.get('x-mhw-secret');
  if (!process.env.SHOPIFY_SYNC_SECRET || secret !== process.env.SHOPIFY_SYNC_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Shopify order name is like "#31312"; store the bare number to match our import.
  const orderNumber =
    clean(payload?.name)?.replace(/^#/, '') ??
    clean(payload?.order_number) ??
    clean(payload?.id);
  if (!orderNumber) {
    return NextResponse.json({ error: 'no order number in payload' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // --- dedupe: never create the same order twice, never backdate ---
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ skipped: 'duplicate', order_number: orderNumber });
  }

  // --- detect a wig line item via product_mappings (CARTER -> N263 etc.) ---
  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('style_name, supplier_style_code, default_cap_style, default_density, default_hair_type')
    .eq('active', true);

  const lineItems: any[] = Array.isArray(payload?.line_items) ? payload.line_items : [];
  let matchedItem: any = null;
  let matchedMapping: any = null;
  for (const li of lineItems) {
    const sku = (li?.sku ?? '').toString().trim().toUpperCase();
    const title = `${li?.title ?? ''} ${li?.name ?? ''}`.toUpperCase();
    const m = (mappings ?? []).find((mp: any) => {
      const code = (mp.supplier_style_code ?? '').toString().trim().toUpperCase();
      const style = (mp.style_name ?? '').toString().trim().toUpperCase();
      return (code && sku === code) || (style && title.includes(style));
    });
    if (m) { matchedItem = li; matchedMapping = m; break; }
  }

  if (!matchedItem) {
    // Not a wig order (accessories, etc.) — acknowledge but don't create anything.
    return NextResponse.json({ skipped: 'no wig line item', order_number: orderNumber });
  }

  // --- gather line-item properties (Shopify stores custom fields here) ---
  const props: { name: string; value: string }[] = Array.isArray(matchedItem?.properties)
    ? matchedItem.properties.map((p: any) => ({ name: (p?.name ?? '').toString(), value: (p?.value ?? '').toString() }))
    : [];
  const prop = (re: RegExp) => props.find((p) => re.test(p.name))?.value ?? null;

  const orderedLength = extractLength([
    prop(/length/i),
    clean(matchedItem?.variant_title),
    clean(matchedItem?.title),
  ]);
  const capSize = clean(prop(/cap\s*size/i)) ?? clean(prop(/^size$/i));
  const colourNotes = clean(prop(/colou?r/i));

  // --- classify (order_type, status, shipping destination, -2" length) ---
  // Default to made-to-order; staff can flip to ready-made on review.
  const classification = classifyOrder({ requestedType: 'made_to_order', customerOrderedLength: orderedLength });
  const supplierLength = calculateSupplierLength(orderedLength).supplierLength;

  // CUSTOM COLOUR must be confirmed with the supplier before payment/production.
  const haystack = [
    matchedItem?.title, matchedItem?.variant_title, colourNotes,
    ...props.map((p) => p.value),
  ].join(' ').toUpperCase();
  const isCustomColour = haystack.includes('CUSTOM COLOUR');

  const needsReview = isCustomColour || classification.needsReview;
  const orderType = needsReview ? 'needs_review' : classification.orderType;
  const status: OrderStatus = needsReview ? 'manager_review_required' : classification.status;

  // --- customer ---
  const ship = payload?.shipping_address ?? payload?.customer?.default_address ?? {};
  const cust = payload?.customer ?? {};
  const fullName =
    clean(ship?.name) ??
    clean([cust?.first_name, cust?.last_name].filter(Boolean).join(' ')) ??
    clean(payload?.email) ??
    'Unknown customer';

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .insert({
      full_name: fullName,
      email: clean(payload?.email) ?? clean(cust?.email),
      phone: clean(ship?.phone) ?? clean(payload?.phone) ?? clean(cust?.phone),
      shipping_address_line1: clean(ship?.address1),
      shipping_address_line2: clean(ship?.address2),
      suburb: clean(ship?.city),
      state: clean(ship?.province),
      postcode: clean(ship?.zip),
      country: clean(ship?.country) ?? 'Australia',
    })
    .select('id')
    .single();
  if (custErr || !customer) {
    return NextResponse.json({ error: `customer insert failed: ${custErr?.message}` }, { status: 500 });
  }

  // --- dates: order date from Shopify, ETA = +40 business days ---
  const createdAt = clean(payload?.created_at);
  const orderDate = createdAt ? new Date(createdAt) : new Date();
  const dateOrdered = orderDate.toISOString().slice(0, 10);
  const eta = addBusinessDays(orderDate, 40).toISOString().slice(0, 10);

  const internalNote = isCustomColour
    ? 'CUSTOM COLOUR - confirm with supplier before payment/production. Auto-imported from Shopify.'
    : 'Auto-imported from Shopify.';

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      source: 'shopify',
      customer_id: customer.id,
      order_type: orderType,
      status,
      risk_level: isCustomColour ? 'high' : 'low',
      customer_facing_product_name: clean(matchedItem?.title),
      internal_style_name: matchedMapping.style_name,
      supplier_style_code: matchedMapping.supplier_style_code,
      customer_ordered_length: orderedLength,
      supplier_order_length: supplierLength,
      cap_style: matchedMapping.default_cap_style ?? null,
      cap_size: capSize,
      // Data rules: Peruvian hair + 150% density unless a note specifies otherwise.
      density: clean(prop(/density/i)) ?? '150%',
      hair_type: matchedMapping.default_hair_type ?? 'human hair',
      colour_notes: colourNotes,
      production_notes: 'Peruvian hair, 150% density unless specified.',
      internal_notes: internalNote,
      shipping_destination: classification.shippingDestination,
      date_ordered: dateOrdered,
      expected_completion_date: eta,
    })
    .select('id')
    .single();
  if (orderErr || !order) {
    return NextResponse.json({ error: `order insert failed: ${orderErr?.message}` }, { status: 500 });
  }

  return NextResponse.json({
    created: true,
    order_id: order.id,
    order_number: orderNumber,
    style: matchedMapping.style_name,
    needs_review: needsReview,
    custom_colour: isCustomColour,
  });
}
