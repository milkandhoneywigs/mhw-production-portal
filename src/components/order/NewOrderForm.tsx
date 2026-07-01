'use client';
import { useState, useTransition } from 'react';
import { createManualOrder } from '@/app/actions/orders';
import { calculateSupplierLength } from '@/lib/business/length';
import type { ProductMapping, Supplier } from '@/lib/types';

// Add custom / manual order. Auto-fills supplier code from the selected style and
// previews the supplier production length (customer length - 2"), flagging when
// the length cannot be parsed (staff must then confirm).
export function NewOrderForm({ mappings, suppliers, isAdmin }: { mappings: ProductMapping[]; suppliers: Supplier[]; isAdmin: boolean }) {
  const [orderType, setOrderType] = useState<'ready_made' | 'made_to_order'>('made_to_order');
  const [style, setStyle] = useState('');
  const [length, setLength] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selected = mappings.find((m) => m.style_name === style);
  const lenPreview = calculateSupplierLength(length);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createManualOrder(fd);
      if (res?.error) setError(res.error);
      // success -> the action redirects to the new order.
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Sales channel */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Sales channel</h2>
        <select name="channel" className="input md:w-64" defaultValue="online">
          <option value="online">ONLINE (website / Shopify)</option>
          <option value="instore">IN-STORE (walk-in / custom)</option>
        </select>
        <p className="text-xs text-muted mt-2">Determines whether the order appears under Online or In-store on the dashboard.</p>
      </div>

      {/* Order type */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Order type</h2>
        <div className="flex gap-3">
          {(['ready_made', 'made_to_order'] as const).map((t) => (
            <label key={t} className={`btn ${orderType === t ? 'btn-primary' : 'btn-secondary'} cursor-pointer`}>
              <input type="radio" name="order_type" value={t} className="sr-only"
                checked={orderType === t} onChange={() => setOrderType(t)} />
              {t === 'ready_made' ? 'READY MADE' : 'MADE TO ORDER'}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted mt-2">
          {orderType === 'ready_made'
            ? 'Ready made ships directly to the customer via DHL.'
            : 'Made to order is produced and shipped to the Milk & Honey showroom.'}
        </p>
      </div>

      {/* Customer */}
      <div className="card p-5 grid md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-muted">Customer</h2>
        <div><label className="label">Full name *</label><input name="customer_full_name" className="input" required /></div>
        <div><label className="label">Email</label><input name="customer_email" type="email" className="input" /></div>
        <div><label className="label">Phone</label><input name="customer_phone" className="input" /></div>
        <div><label className="label">Address line 1</label><input name="address_line1" className="input" /></div>
        <div><label className="label">Address line 2</label><input name="address_line2" className="input" /></div>
        <div><label className="label">Suburb</label><input name="suburb" className="input" /></div>
        <div><label className="label">State</label><input name="state" className="input" /></div>
        <div><label className="label">Postcode</label><input name="postcode" className="input" /></div>
        <div><label className="label">Country</label><input name="country" className="input" defaultValue="Australia" /></div>
      </div>

      {/* Product / production */}
      <div className="card p-5 grid md:grid-cols-2 gap-4">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-muted">Product &amp; production</h2>
        <div>
          <label className="label">Style *</label>
          <select name="internal_style_name" className="input" required value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">Select a style…</option>
            {mappings.map((m) => <option key={m.id} value={m.style_name}>{m.style_name} ({m.supplier_style_code})</option>)}
          </select>
          {selected && <p className="text-xs text-muted mt-1">Supplier code auto-filled: <b>{selected.supplier_style_code}</b></p>}
        </div>
        <div>
          <label className="label">Customer facing product name</label>
          <input name="customer_facing_product_name" className="input" placeholder={style || 'e.g. ANEESHA 18 inch'} />
        </div>
        <div>
          <label className="label">Customer ordered length</label>
          <input name="customer_ordered_length" className="input" value={length} onChange={(e) => setLength(e.target.value)} placeholder='e.g. 18 or 18"' />
        </div>
        <div>
          <label className="label">Supplier production length {orderType === 'made_to_order' && <span className="text-muted">(auto -2")</span>}</label>
          <input name="supplier_order_length" className="input"
            placeholder={orderType === 'made_to_order'
              ? (lenPreview.needsReview ? '⚠ confirm manually' : lenPreview.supplierLength ?? '')
              : 'n/a for ready made'} />
          {orderType === 'made_to_order' && lenPreview.needsReview && length && (
            <p className="text-xs text-red-600 mt-1">Cannot auto-convert: {lenPreview.reason}. This will be flagged NEEDS REVIEW unless you enter a length here.</p>
          )}
          {orderType === 'made_to_order' && !lenPreview.needsReview && lenPreview.supplierLength && (
            <p className="text-xs text-emerald-700 mt-1">Preview: supplier length {lenPreview.supplierLength}" (leave blank to use this).</p>
          )}
        </div>
        <div><label className="label">Cap style</label><input name="cap_style" className="input" /></div>
        <div><label className="label">Cap size</label><input name="cap_size" className="input" /></div>
        <div><label className="label">Density</label><input name="density" className="input" defaultValue="150%" /><p className="text-xs text-muted mt-1">Always 150% unless the order specifies otherwise.</p></div>
        <div><label className="label">Hair type</label><input name="hair_type" className="input" defaultValue="human hair" /></div>
        <div className="md:col-span-2"><label className="label">Colour notes</label><input name="colour_notes" className="input" /></div>
        <div className="md:col-span-2"><label className="label">Production notes (supplier can see)</label><textarea name="production_notes" className="input" rows={2} /></div>
        <div className="md:col-span-2"><label className="label">Internal notes (staff only)</label><textarea name="internal_notes" className="input" rows={2} /></div>
        {isAdmin && (
          <div>
            <label className="label">Assign supplier</label>
            <select name="supplier_id" className="input" defaultValue={suppliers.length === 1 ? suppliers[0].id : ''}>
              {suppliers.length !== 1 && <option value="">Unassigned</option>}
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">Order number (optional)</label><input name="order_number" className="input" placeholder="auto-generated if blank" /></div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Creating…' : 'Create order'}</button>
        <a href="/orders" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
