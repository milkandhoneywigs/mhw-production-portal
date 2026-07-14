import { notFound } from 'next/navigation';
import { requireSupplier } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, Section } from '@/components/ui';
import { StatusBadge, OrderTypeBadge } from '@/components/Badges';
import { PrimaryActionPanel } from '@/components/supplier/PrimaryActionPanel';
import { MessageThread } from '@/components/supplier/MessageThread';
import { ProgressSteps, ProgressBar } from '@/components/supplier/Summary';
import { primaryActionFor, daysUntil } from '@/lib/supplier-portal';
import { supplierShippingInstruction, STATUS_LABELS, type OrderStatus, type OrderType } from '@/lib/constants';
import { signFileUrls } from '@/lib/storage';
import type { SupplierOrderRow } from '@/lib/supplier-data';
import type { Invoice, OrderMessage, OrderDelay, OrderFile, RestockItemRow, SupplierUpdate, Tracking } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MTO_STEPS = ['Confirmed', 'Production started', 'In production', 'Quality check', 'Approved', 'Shipped', 'Received'];

function mtoStepIndex(status: OrderStatus): number {
  if ((['new_made_to_order', 'awaiting_supplier_confirmation'] as OrderStatus[]).includes(status)) return 0;
  if ((['invoice_uploaded', 'payment_required', 'payment_paid'] as OrderStatus[]).includes(status)) return 1;
  if ((['in_production', 'production_update_due', 'delayed_at_risk'] as OrderStatus[]).includes(status)) return 2;
  if ((['production_complete', 'qc_required', 'balance_payment_required', 'manager_review_required'] as OrderStatus[]).includes(status)) return 3;
  if ((['qc_passed', 'balance_paid', 'ready_to_dispatch'] as OrderStatus[]).includes(status)) return 4;
  if ((['shipped_to_showroom', 'dispatched_to_customer', 'tracking_uploaded'] as OrderStatus[]).includes(status)) return 5;
  if ((['arrived_at_showroom', 'completed', 'customer_notified'] as OrderStatus[]).includes(status)) return 6;
  return 0;
}

interface TimelineEvent { at: string; icon: string; text: string }

export default async function SupplierOrderDetail({ params }: { params: { id: string } }) {
  const profile = await requireSupplier();
  const supabase = createClient();

  // RLS: returns nothing unless this order belongs to the signed-in supplier.
  const { data: order } = await supabase.from('v_supplier_orders').select('*').eq('id', params.id).single<SupplierOrderRow>();
  if (!order) notFound();

  const [
    { data: msgs }, { data: updates }, { data: trackingRows },
    { data: invoices }, { data: files }, { data: delays }, { data: restock },
  ] = await Promise.all([
    supabase.from('order_messages').select('*').eq('order_id', order.id).order('created_at'),
    supabase.from('supplier_updates').select('*').eq('order_id', order.id).order('created_at'),
    supabase.from('tracking').select('*').eq('order_id', order.id).order('created_at'),
    supabase.from('invoices').select('*').eq('order_id', order.id).order('created_at'),
    supabase.from('files').select('*').eq('order_id', order.id).order('created_at'),
    supabase.from('order_delays').select('*').eq('order_id', order.id).order('created_at'),
    order.order_type === 'stock'
      ? supabase.from('restock_items').select('*').eq('order_id', order.id).order('position')
      : Promise.resolve({ data: [] as RestockItemRow[] }),
  ]);

  // Shipping block: ONLY after confirmation, ONLY for direct-to-customer orders.
  // Fetched with the service client (suppliers have no customers-table access) —
  // minimal columns, never the email.
  let shipping: { full_name: string; line1: string | null; line2: string | null; locality: string; country: string | null; phone: string | null } | null = null;
  if (order.supplier_confirmed_at && order.shipping_destination === 'customer_direct') {
    const service = createServiceClient();
    const { data: full } = await service.from('orders').select('customer_id').eq('id', order.id).single();
    if (full?.customer_id) {
      const { data: c } = await service.from('customers')
        .select('full_name, phone, shipping_address_line1, shipping_address_line2, suburb, state, postcode, country')
        .eq('id', full.customer_id).single();
      if (c) {
        shipping = {
          full_name: c.full_name, phone: c.phone,
          line1: c.shipping_address_line1, line2: c.shipping_address_line2,
          locality: [c.suburb, c.state, c.postcode].filter(Boolean).join(' '),
          country: c.country,
        };
      }
    }
  }

  // Signed URLs for private attachments/files.
  const fileRefs = [
    ...((files ?? []) as OrderFile[]).map((f) => f.file_url),
    ...((msgs ?? []) as OrderMessage[]).map((m) => m.attachment_url).filter(Boolean) as string[],
    ...((invoices ?? []) as Invoice[]).flatMap((i) => [i.file_url, i.receipt_url]).filter(Boolean) as string[],
  ];
  const urls = await signFileUrls(fileRefs);

  // Production timeline (chronological).
  const events: TimelineEvent[] = [
    { at: order.created_at, icon: '🆕', text: 'Order created' },
    ...(order.supplier_confirmed_at ? [{ at: order.supplier_confirmed_at, icon: '✅', text: 'Order confirmed' }] : []),
    ...((updates ?? []) as SupplierUpdate[]).map((u) => ({ at: u.created_at, icon: '📝', text: u.message ?? u.update_type })),
    ...((trackingRows ?? []) as Tracking[]).map((t) => ({ at: t.created_at, icon: '🚚', text: `Tracking: ${t.carrier ?? ''} ${t.tracking_number ?? ''}` })),
    ...((invoices ?? []) as Invoice[]).map((i) => ({ at: i.created_at, icon: '🧾', text: `Invoice ${i.invoice_number ?? ''} — ${i.status.replaceAll('_', ' ')}${i.amount ? ` ($${i.amount})` : ''}` })),
    ...((delays ?? []) as OrderDelay[]).map((d) => ({ at: d.created_at, icon: '⚠️', text: `Delay: ${d.reason}${d.revised_completion_date ? ` (revised: ${d.revised_completion_date})` : ''}` })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const action = primaryActionFor(order.order_type as OrderType, order.status);
  const days = daysUntil(order.expected_completion_date);
  const overdue = days !== null && days < 0 && !(['completed', 'cancelled', 'tracking_uploaded', 'customer_notified'] as OrderStatus[]).includes(order.status);
  const restockItems = (restock ?? []) as RestockItemRow[];
  const totalUnits = restockItems.reduce((s, i) => s + i.quantity, 0);
  const doneUnits = restockItems.reduce((s, i) => s + i.qty_completed, 0);

  return (
    <>
      <PageHeader
        title={`Order #${order.order_number}`}
        subtitle={order.supplier_reference ? `Your reference: ${order.supplier_reference}` : undefined}
        action={<div className="flex gap-2 items-center"><OrderTypeBadge type={order.order_type as OrderType} /><StatusBadge status={order.status} /></div>}
      />

      {overdue && (
        <div className="card p-3 mb-4 border border-red-300 bg-red-50 text-sm text-red-800 font-medium">
          ⚠ This order is {Math.abs(days!)} days overdue (due {new Date(order.expected_completion_date!).toLocaleDateString('en-AU')}).
          Please report the delay with a reason and a revised completion date.
        </div>
      )}

      <div className="card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><span className="text-muted">Ordered:</span> {new Date(order.date_ordered).toLocaleDateString('en-AU')}</span>
          {order.expected_completion_date && (
            <span><span className="text-muted">Due:</span> {new Date(order.expected_completion_date).toLocaleDateString('en-AU')}
              {days !== null && days >= 0 && <span className="text-muted"> ({days} days left)</span>}
            </span>
          )}
          <span><span className="text-muted">Status:</span> {STATUS_LABELS[order.status]}</span>
        </div>
        <p className="text-sm font-medium text-ink">
          {supplierShippingInstruction(order.order_type, order.shipping_destination ?? '')}
        </p>
        <PrimaryActionPanel
          order={{
            id: order.id, order_number: order.order_number, order_type: order.order_type,
            status: order.status, supplier_price: order.supplier_price,
            shipping_destination: order.shipping_destination, expected_completion_date: order.expected_completion_date,
          }}
          action={action}
          overdue={overdue}
        />
      </div>

      {order.order_type === 'made_to_order' && (
        <Section title="Production progress">
          <ProgressSteps steps={MTO_STEPS} current={mtoStepIndex(order.status)} />
        </Section>
      )}

      {order.order_type === 'stock' && restockItems.length > 0 && (
        <Section title={`Line items (${restockItems.length} styles · ${totalUnits} units)`}>
          <div className="card p-4 space-y-3">
            <ProgressBar done={doneUnits} total={totalUnits} />
            <table className="w-full text-xs">
              <thead className="text-muted"><tr className="text-left">
                <th className="py-1">Style</th><th>Code</th><th>Colour</th><th>Length</th><th>Cap</th><th>Qty</th><th>Done</th><th>Status</th>
              </tr></thead>
              <tbody>
                {restockItems.map((it) => (
                  <tr key={it.id} className="border-t border-beige/60">
                    <td className="py-1 font-medium">{it.style_name}</td>
                    <td>{it.supplier_style_code ?? '-'}</td>
                    <td>{it.colour ?? '-'}</td>
                    <td>{it.length ?? '-'}</td>
                    <td>{it.cap_size ?? '-'}</td>
                    <td className="tabular-nums">{it.quantity}</td>
                    <td className="tabular-nums">{it.qty_completed}</td>
                    <td>{it.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Section title="Product details">
            <div className="card p-4">
              <dl className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="text-muted">Style:</span> {order.internal_style_name ?? '-'}</div>
                <div><span className="text-muted">Code:</span> {order.supplier_style_code ?? '-'}</div>
                <div><span className="text-muted">Length to make:</span> {order.supplier_order_length ?? '-'}</div>
                <div><span className="text-muted">Cap:</span> {order.cap_style ?? '-'}</div>
                <div><span className="text-muted">Cap size:</span> {order.cap_size ?? '-'}</div>
                <div><span className="text-muted">Density:</span> {order.density ?? '-'}</div>
                <div><span className="text-muted">Hair:</span> {order.hair_type ?? '-'}</div>
                <div><span className="text-muted">Quantity:</span> {order.quantity}</div>
              </dl>
              {order.colour_notes && <p className="text-sm mt-2"><span className="text-muted">Colour:</span> {order.colour_notes}</p>}
              {order.production_notes && <p className="text-sm mt-1"><span className="text-muted">Notes:</span> {order.production_notes}</p>}
            </div>
          </Section>

          {shipping ? (
            <Section title="Shipping address (DHL)">
              <div className="card p-4 text-sm space-y-0.5">
                <p className="font-medium">{shipping.full_name}</p>
                {shipping.line1 && <p>{shipping.line1}</p>}
                {shipping.line2 && <p>{shipping.line2}</p>}
                <p>{shipping.locality}</p>
                <p>{shipping.country}</p>
                {shipping.phone && <p><span className="text-muted">Phone:</span> {shipping.phone}</p>}
                <p className="text-xs text-muted pt-1">Use this address to create the DHL shipment. Ship direct to the customer — not to the showroom.</p>
              </div>
            </Section>
          ) : order.shipping_destination === 'customer_direct' && (
            <Section title="Shipping address">
              <div className="card p-4 text-sm text-muted">
                The customer&apos;s shipping address is shown here after you confirm the order.
              </div>
            </Section>
          )}

          <Section title="Financial">
            <div className="card p-4 text-sm space-y-2">
              <p><span className="text-muted">Your price:</span> {order.supplier_price ? `$${Number(order.supplier_price).toFixed(2)} USD (incl. shipping)` : 'Not added yet'}</p>
              {((invoices ?? []) as Invoice[]).length === 0 ? (
                <p className="text-muted">No invoices yet.</p>
              ) : (
                <ul className="space-y-1">
                  {((invoices ?? []) as Invoice[]).map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{i.invoice_number ?? i.invoice_type}</span>
                      {i.amount != null && <span>${Number(i.amount).toFixed(2)}</span>}
                      <span className="text-xs rounded-full px-2 py-0.5 bg-sand ring-1 ring-beige">{i.status.replaceAll('_', ' ')}</span>
                      {i.file_url && urls[i.file_url] && <a className="text-xs underline" href={urls[i.file_url]} target="_blank" rel="noreferrer">view</a>}
                      {i.receipt_url && urls[i.receipt_url] && <a className="text-xs underline text-emerald-700" href={urls[i.receipt_url]} target="_blank" rel="noreferrer">🧾 transfer receipt</a>}
                      {i.notes && <span className="text-xs text-red-700 w-full">Note from Milk &amp; Honey: {i.notes}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section title="Files">
            <div className="card p-4 text-sm">
              {((files ?? []) as OrderFile[]).length === 0 ? (
                <p className="text-muted">No files yet.</p>
              ) : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {((files ?? []) as OrderFile[]).map((f) => {
                    const url = urls[f.file_url];
                    const name = f.file_url.split('/').pop()?.replace(/^\d+-/, '') ?? f.file_type;
                    const isImage = /\.(jpe?g|png|webp|heic)$/i.test(name);
                    return (
                      <li key={f.id}>
                        {url ? (
                          isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={name} className="rounded-lg h-24 w-full object-cover" /></a>
                          ) : (
                            <a href={url} target="_blank" rel="noreferrer" className="underline text-xs">📎 {name}</a>
                          )
                        ) : <span className="text-xs text-muted">{name}</span>}
                        <div className="text-[10px] text-muted">{f.file_type.replaceAll('_', ' ')}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Timeline">
            <div className="card p-4">
              <ol className="space-y-2 text-sm max-h-80 overflow-y-auto pr-1">
                {events.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden>{e.icon}</span>
                    <div className="min-w-0">
                      <p className="leading-snug">{e.text}</p>
                      <p className="text-[11px] text-muted">{new Date(e.at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Section>

          <Section title="Messages">
            <div className="card p-4" id="messages">
              <MessageThread orderId={order.id} messages={(msgs ?? []) as OrderMessage[]} meId={profile.id} attachmentUrls={urls} />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
