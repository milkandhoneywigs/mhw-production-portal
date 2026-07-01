import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { StageBadge, StatusBadge, OrderTypeBadge, RiskBadge, Flag } from '@/components/Badges';
import { InstructionButton } from '@/components/order/InstructionButton';
import { StatusSelect } from '@/components/order/StatusSelect';
import { DeleteOrderButton } from '@/components/order/DeleteOrderButton';
import { calculateRiskLevel, isShipmentBlocked } from '@/lib/business/risk';
import { SUPPLIER_INSTRUCTION_SHIPPING, STAGE_NOTE, stageOf } from '@/lib/constants';
import type { Order, Customer, Supplier, Invoice, Tracking, SupplierUpdate } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-beige/60 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="col-span-2 text-sm">{value || <span className="text-muted">-</span>}</dd>
    </div>
  );
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const profile = await requireStaff();
  const isAdmin = profile.role === 'admin'; // supplier name is admin-only
  const supabase = createClient();

  const { data: order } = await supabase.from('orders').select('*').eq('id', params.id).single();
  if (!order) notFound();
  const o = order as Order;

  const [{ data: customer }, { data: supplier }, { data: invoices }, { data: tracking }, { data: updates }, { data: history }] =
    await Promise.all([
      o.customer_id ? supabase.from('customers').select('*').eq('id', o.customer_id).single() : Promise.resolve({ data: null }),
      o.supplier_id ? supabase.from('suppliers').select('*').eq('id', o.supplier_id).single() : Promise.resolve({ data: null }),
      supabase.from('invoices').select('*').eq('order_id', o.id).order('created_at'),
      supabase.from('tracking').select('*').eq('order_id', o.id).order('created_at'),
      supabase.from('supplier_updates').select('*').eq('order_id', o.id).order('created_at', { ascending: false }),
      supabase.from('order_status_history').select('*').eq('order_id', o.id).order('created_at', { ascending: false }),
    ]);

  const cust = customer as Customer | null;
  const invs = (invoices ?? []) as Invoice[];
  const risk = calculateRiskLevel(o, invs);
  const blocked = isShipmentBlocked(o, invs);

  // ETA (order date + 40 business days). Flag when overdue and not complete.
  const eta = o.expected_completion_date;
  const overdue = !!eta && !o.production_complete_at && new Date(eta) < new Date();
  const etaDisplay = eta
    ? <span className={overdue ? 'text-red-600 font-medium' : ''}>{eta}{overdue ? ' — OVERDUE (>40 business days)' : ''}</span>
    : <span className="text-muted">not set</span>;

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold">{o.order_number}</h1>
        <OrderTypeBadge type={o.order_type} />
        <StageBadge status={o.status} />
        <RiskBadge level={risk.level} />
        {blocked && <Flag tone="blocked">SHIPMENT BLOCKED</Flag>}
        {overdue && <Flag tone="risk">OVERDUE</Flag>}
      </div>
      <p className="text-sm text-muted -mt-4 mb-6">{STAGE_NOTE[stageOf(o.status)]} <span className="text-xs">(detail: <StatusBadge status={o.status} />)</span></p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Production details</h2>
            <dl>
              <Row label="Internal style" value={o.internal_style_name} />
              <Row label="Supplier code" value={o.supplier_style_code} />
              <Row label="Customer length" value={o.customer_ordered_length} />
              <Row label="Supplier length" value={o.supplier_order_length} />
              <Row label="Cap style" value={o.cap_style} />
              <Row label="Cap size" value={o.cap_size} />
              <Row label="Density" value={o.density} />
              <Row label="Hair type" value={o.hair_type} />
              <Row label="Colour notes" value={o.colour_notes} />
              <Row label="Production notes" value={o.production_notes} />
              <Row label="Estimated completion (ETA)" value={etaDisplay} />
              <Row label="Shipping destination" value={o.shipping_destination.replace('_', ' ')} />
              <Row label="Supplier instruction" value={
                o.order_type === 'ready_made' ? SUPPLIER_INSTRUCTION_SHIPPING.ready_made
                : o.order_type === 'made_to_order' ? SUPPLIER_INSTRUCTION_SHIPPING.made_to_order : '-'} />
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Customer</h2>
            <dl>
              <Row label="Name" value={cust?.full_name} />
              <Row label="Email" value={cust?.email} />
              <Row label="Phone" value={cust?.phone} />
              <Row label="Address" value={[cust?.shipping_address_line1, cust?.shipping_address_line2, [cust?.suburb, cust?.state, cust?.postcode].filter(Boolean).join(' '), cust?.country].filter(Boolean).join(', ')} />
            </dl>
          </div>

          {/* Internal notes — staff view only (never rendered to suppliers). */}
          {o.internal_notes && (
            <div className="card p-5 ring-1 ring-amber-200">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700 mb-2">Internal notes (staff only)</h2>
              <p className="text-sm whitespace-pre-wrap">{o.internal_notes}</p>
            </div>
          )}

          {/* Invoices */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Invoices</h2>
            {invs.length === 0 ? <p className="text-sm text-muted">No invoices yet.</p> : (
              <table className="w-full text-sm">
                <thead><tr>
                  <th className="th">Type</th><th className="th">Number</th><th className="th">Amount</th><th className="th">Status</th><th className="th">Reference</th>
                </tr></thead>
                <tbody className="divide-y divide-beige">
                  {invs.map((i) => (
                    <tr key={i.id}>
                      <td className="td capitalize">{i.invoice_type}</td>
                      <td className="td">{i.invoice_number ?? '-'}</td>
                      <td className="td">{i.amount ? `${i.currency} ${i.amount}` : '-'}</td>
                      <td className="td">{i.status === 'paid'
                        ? <Flag tone="ready">PAID</Flag>
                        : <Flag tone={i.invoice_type === 'balance' ? 'balance' : 'payment'}>{i.invoice_type === 'balance' ? 'BALANCE REQUIRED' : 'PAYMENT REQUIRED'}</Flag>}</td>
                      <td className="td">{i.payment_reference ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-xs text-muted mt-2">Mark invoices paid on the <a href="/billing" className="underline">Billing</a> dashboard.</p>
          </div>

          {/* Tracking */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Tracking</h2>
            {(tracking ?? []).length === 0 ? <p className="text-sm text-muted">No tracking uploaded.</p> : (
              <ul className="text-sm space-y-1">
                {(tracking as Tracking[]).map((t) => (
                  <li key={t.id}>
                    <span className="capitalize">{t.tracking_type.replace(/_/g, ' ')}</span>: {t.carrier} {t.tracking_number}
                    {t.tracking_url && <> — <a className="underline" href={t.tracking_url} target="_blank" rel="noreferrer">track</a></>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: controls + timelines */}
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Actions</h2>
            <StatusSelect orderId={o.id} current={o.status} orderType={o.order_type} />
            {isAdmin && <Row label="Supplier" value={(supplier as Supplier | null)?.name} />}
            <InstructionButton orderId={o.id} />
            <div className="pt-3 border-t border-beige">
              <DeleteOrderButton orderId={o.id} orderNumber={o.order_number} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Supplier updates</h2>
            {(updates ?? []).length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
              <ul className="space-y-3">
                {(updates as SupplierUpdate[]).map((u) => (
                  <li key={u.id} className="text-sm border-l-2 border-beige pl-3">
                    <div className="font-medium capitalize">{u.update_type.replace(/_/g, ' ')}</div>
                    {u.message && <div className="text-muted">{u.message}</div>}
                    <div className="text-xs text-muted mt-0.5">{new Date(u.created_at).toLocaleString('en-AU')}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Status history</h2>
            {(history ?? []).length === 0 ? <p className="text-sm text-muted">No changes yet.</p> : (
              <ul className="space-y-2 text-xs">
                {(history as { id: string; old_status: string | null; new_status: string; created_at: string }[]).map((h) => (
                  <li key={h.id} className="text-muted">
                    {new Date(h.created_at).toLocaleString('en-AU')}: {h.old_status ?? 'new'} → <span className="text-ink font-medium">{h.new_status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
