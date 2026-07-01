'use client';
import { useState, useTransition } from 'react';
import { createRestockOrder } from '@/app/actions/restock';
import { SHOWROOMS } from '@/lib/business/restock';
import type { ProductMapping } from '@/lib/types';

interface Row { key: number; style: string; length: string; cap: string; qty: string }
let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, style: '', length: '', cap: '', qty: '1' });

const MAX_ROWS = 10;

// Bulk store restock: pick a showroom, add up to 10 lines (style -> auto SKU,
// length, cap size, qty). Submits as one order for the supplier to price.
export function RestockOrderForm({ mappings }: { mappings: ProductMapping[] }) {
  const [rows, setRows] = useState<Row[]>([blankRow(), blankRow(), blankRow()]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const skuFor = (style: string) => mappings.find((m) => m.style_name === style)?.supplier_style_code ?? '';
  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => (rs.length >= MAX_ROWS ? rs : [...rs, blankRow()]));
  const removeRow = (key: number) => setRows((rs) => (rs.length <= 1 ? rs : rs.filter((r) => r.key !== key)));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createRestockOrder(fd);
      if (res?.error) setError(res.error);
      // success -> the action redirects to the new order.
    });
  }

  const filled = rows.filter((r) => r.style).length;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Destination */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Restock destination</h2>
        <select name="destination" className="input md:w-72" defaultValue="sydney">
          {SHOWROOMS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <p className="text-xs text-muted mt-2">Stock will be shipped to the selected showroom.</p>
      </div>

      {/* Line items */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Restock items ({filled})</h2>
          <button type="button" className="btn-secondary text-xs" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
            + Add line {rows.length >= MAX_ROWS && '(max 10)'}
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="th">Style</th><th className="th">SKU</th><th className="th">Length</th><th className="th">Cap size</th><th className="th w-20">Qty</th><th className="th w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="align-top">
                <td className="td">
                  <select className="input" value={r.style} onChange={(e) => update(r.key, { style: e.target.value })} name="style_name">
                    <option value="">Select style…</option>
                    {mappings.map((m) => <option key={m.id} value={m.style_name}>{m.style_name}</option>)}
                  </select>
                </td>
                <td className="td text-sm text-muted whitespace-nowrap pt-3">{r.style ? skuFor(r.style) : '—'}</td>
                <td className="td"><input name="length" value={r.length} onChange={(e) => update(r.key, { length: e.target.value })} className="input" placeholder='e.g. 18"' /></td>
                <td className="td"><input name="cap_size" value={r.cap} onChange={(e) => update(r.key, { cap: e.target.value })} className="input" placeholder="e.g. Medium" /></td>
                <td className="td"><input name="quantity" type="number" min="1" value={r.qty} onChange={(e) => update(r.key, { qty: e.target.value })} className="input" /></td>
                <td className="td pt-3">
                  <button type="button" className="text-muted hover:text-red-600 text-sm" onClick={() => removeRow(r.key)} title="Remove line" disabled={rows.length <= 1}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted mt-2">Only lines with a style selected are submitted. SKU auto-fills from the style. Once submitted, the supplier adds pricing and sends it back for payment.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary" disabled={pending || filled === 0}>{pending ? 'Creating…' : 'Submit restock to supplier'}</button>
        <a href="/orders" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
