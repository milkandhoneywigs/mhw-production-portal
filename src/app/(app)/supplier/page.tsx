import { requireSupplier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Section, EmptyState } from '@/components/ui';
import { StageBadge, OrderTypeBadge } from '@/components/Badges';
import { SupplierActions } from '@/components/supplier/SupplierActions';
import { OrderMessages } from '@/components/order/OrderMessages';
import { parseRestock, showroomLabel, totalUnits } from '@/lib/business/restock';
import type { OrderMessage } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Supplier-safe order shape (from the v_supplier_orders view — no internal_notes,
// no risk, no financials).
interface SupplierOrder {
  id: string; order_number: string; order_type: 'ready_made' | 'made_to_order' | 'stock' | 'needs_review';
  status: any; supplier_style_code: string | null; internal_style_name: string | null;
  customer_ordered_length: string | null; supplier_order_length: string | null;
  cap_size: string | null; density: string | null; colour_notes: string | null;
  production_notes: string | null; expected_completion_date: string | null;
}

const BUCKETS: { title: string; statuses: string[] }[] = [
  { title: 'New READY MADE — ship direct to customer', statuses: ['new_ready_made_order'] },
  { title: 'New MADE TO ORDER — production required', statuses: ['new_made_to_order', 'awaiting_supplier_confirmation'] },
  { title: 'Invoice required / uploaded', statuses: ['invoice_uploaded', 'payment_required'] },
  { title: 'In production', statuses: ['in_production', 'production_update_due'] },
  { title: 'Production complete / waiting for balance', statuses: ['production_complete', 'balance_payment_required'] },
  { title: 'Ready to ship', statuses: ['payment_paid', 'balance_paid', 'supplier_notified', 'awaiting_dhl_tracking'] },
  { title: 'Completed', statuses: ['shipped_to_showroom', 'tracking_uploaded', 'arrived_at_showroom', 'qc_required', 'qc_passed', 'ready_to_dispatch', 'dispatched_to_customer', 'customer_notified', 'completed'] },
];

export default async function SupplierDashboard() {
  const profile = await requireSupplier();
  const supabase = createClient();
  // RLS on the underlying orders table restricts these to the supplier's own orders.
  const [{ data }, { data: allMsgs }] = await Promise.all([
    supabase.from('v_supplier_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('order_messages').select('*').order('created_at'),
  ]);
  const orders = (data ?? []) as SupplierOrder[];
  const msgsByOrder: Record<string, OrderMessage[]> = {};
  for (const m of (allMsgs ?? []) as OrderMessage[]) (msgsByOrder[m.order_id] ??= []).push(m);

  return (
    <>
      <PageHeader title="My Orders" subtitle="Orders assigned to you. You only see your own orders." />
      {orders.length === 0 && <EmptyState>No orders assigned to you yet.</EmptyState>}

      {BUCKETS.map((bucket) => {
        const items = orders.filter((o) => bucket.statuses.includes(o.status));
        if (items.length === 0) return null;
        return (
          <Section key={bucket.title} title={`${bucket.title} (${items.length})`}>
            <div className="grid md:grid-cols-2 gap-3">
              {items.map((o) => {
                const restock = o.order_type === 'stock' ? parseRestock(o.production_notes) : null;
                return (
                <div key={o.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-medium">{o.order_number}</span>
                    <div className="flex gap-2"><OrderTypeBadge type={o.order_type} /><StageBadge status={o.status} /></div>
                  </div>
                  {restock ? (
                    <div>
                      <p className="text-sm font-medium mb-1">Store restock — {showroomLabel(restock.destination)} <span className="text-muted font-normal">({restock.items.length} styles · {totalUnits(restock.items)} units)</span></p>
                      <table className="w-full text-xs mt-1">
                        <thead className="text-muted"><tr className="text-left"><th className="py-0.5">Style</th><th>SKU</th><th>Length</th><th>Cap</th><th>Qty</th></tr></thead>
                        <tbody>
                          {restock.items.map((it, idx) => (
                            <tr key={idx} className="border-t border-beige/60">
                              <td className="py-0.5 font-medium">{it.style_name}</td><td>{it.supplier_style_code ?? '-'}</td><td>{it.length ?? '-'}</td><td>{it.cap_size ?? '-'}</td><td className="tabular-nums">{it.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-xs mt-2 font-medium text-ink">Produce and ship this restock to the {showroomLabel(restock.destination)}. Add pricing below to send it back for payment.</p>
                    </div>
                  ) : (<>
                  <dl className="text-sm grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <div><span className="text-muted">Code:</span> {o.supplier_style_code ?? '-'}</div>
                    <div><span className="text-muted">Style:</span> {o.internal_style_name ?? '-'}</div>
                    <div><span className="text-muted">Cust length:</span> {o.customer_ordered_length ?? '-'}</div>
                    <div><span className="text-muted">Prod length:</span> {o.supplier_order_length ?? '-'}</div>
                    <div><span className="text-muted">Cap size:</span> {o.cap_size ?? '-'}</div>
                    <div><span className="text-muted">Density:</span> {o.density ?? '-'}</div>
                  </dl>
                  {o.colour_notes && <p className="text-xs mt-1"><span className="text-muted">Colour:</span> {o.colour_notes}</p>}
                  {o.production_notes && <p className="text-xs mt-1"><span className="text-muted">Notes:</span> {o.production_notes}</p>}
                  {/* Shipping reminder per order type */}
                  <p className="text-xs mt-2 font-medium text-ink">
                    {o.order_type === 'ready_made'
                      ? 'Ship directly to customer via DHL. Do not ship to Milk & Honey showroom.'
                      : 'Produce and ship to the Milk & Honey showroom once complete. Do not ship directly to customer.'}
                  </p>
                  </>)}
                  <SupplierActions orderId={o.id} isReadyMade={o.order_type === 'ready_made'} />
                  <OrderMessages orderId={o.id} messages={msgsByOrder[o.id] ?? []} meId={profile.id} compact />
                </div>
                );
              })}
            </div>
          </Section>
        );
      })}
    </>
  );
}
