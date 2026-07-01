'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { etaFor } from '@/lib/business/eta';
import {
  SHOWROOMS, serializeRestock, showroomLabel, totalUnits,
  type RestockItem, type RestockData,
} from '@/lib/business/restock';
import type { OrderStatus } from '@/lib/constants';

function generateRestockNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RS-${ymd}-${rand}`;
}

// Create a store restock order: one order (order_type 'stock') to a chosen
// showroom, with up to ~10 line items. Goes to the supplier for pricing exactly
// like any other order. Staff + admin can create these.
export async function createRestockOrder(formData: FormData): Promise<{ error?: string }> {
  const profile = await requireStaff();
  const supabase = createClient();

  const destinationValue = formData.get('destination')?.toString() || 'sydney';
  const showroom = SHOWROOMS.find((s) => s.value === destinationValue) ?? SHOWROOMS[0];

  // Repeated line-item fields (same input name per row).
  const styles = formData.getAll('style_name').map((v) => v.toString().trim());
  const lengths = formData.getAll('length').map((v) => v.toString().trim());
  const capSizes = formData.getAll('cap_size').map((v) => v.toString().trim());
  const quantities = formData.getAll('quantity').map((v) => v.toString().trim());

  // Look up SKUs for the chosen styles.
  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('style_name, supplier_style_code')
    .eq('active', true);
  const codeFor = (style: string) =>
    (mappings ?? []).find((m: any) => m.style_name === style)?.supplier_style_code ?? null;

  const items: RestockItem[] = [];
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    if (!style) continue; // skip empty rows
    const qty = Math.max(1, parseInt(quantities[i] || '1', 10) || 1);
    items.push({
      style_name: style,
      supplier_style_code: codeFor(style),
      length: lengths[i] || null,
      cap_size: capSizes[i] || null,
      quantity: qty,
    });
  }

  if (items.length === 0) return { error: 'Add at least one line item.' };

  const restock: RestockData = { restock: true, destination: showroom.value as RestockData['destination'], items };

  // Assign the sole active supplier (CBW).
  let supplierId: string | null = null;
  const { data: sole } = await supabase.from('suppliers').select('id').eq('active', true);
  if (sole && sole.length === 1) supplierId = sole[0].id;

  const orderNumber = generateRestockNumber();
  const units = totalUnits(items);
  const status: OrderStatus = 'new_made_to_order'; // supplier prices it from here

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      source: 'other',
      order_type: 'stock',
      status,
      supplier_id: supplierId,
      assigned_staff_id: profile.id,
      customer_facing_product_name: `Store restock — ${showroom.label} (${items.length} styles / ${units} units)`,
      internal_style_name: `STORE RESTOCK — ${showroom.label}`,
      shipping_destination: showroom.shippingDestination,
      // Line-item sheet lives here (supplier-visible). Identified by order_type 'stock'.
      production_notes: serializeRestock(restock),
      // Restocks ship to a showroom -> in-store 20 business day lead time.
      expected_completion_date: etaFor('instore'),
    })
    .select('id')
    .single();
  if (error || !order) return { error: `Could not create restock order: ${error?.message}` };

  await logAudit({
    actorId: profile.id, action: 'restock.create', entityType: 'order', entityId: order.id,
    metadata: { order_number: orderNumber, destination: showroomLabel(restock.destination), styles: items.length, units },
  });

  redirect(`/orders/${order.id}`);
}
