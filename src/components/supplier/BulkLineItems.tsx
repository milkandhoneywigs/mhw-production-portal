'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supplierUpdateRestockItem } from '@/app/actions/supplier';
import { toast } from './Feedback';
import type { RestockItemRow } from '@/lib/types';

// Expandable line items of a bulk order; the supplier updates quantities
// completed per line (capped at the ordered quantity server-side).
export function BulkLineItems({ items }: { items: RestockItemRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [edits, setEdits] = useState<Record<string, string>>({});

  if (items.length === 0) return <p className="text-sm text-muted">No line items.</p>;

  function save(it: RestockItemRow, done = false) {
    const qty = Number(edits[it.id] ?? it.qty_completed);
    start(async () => {
      const res = await supplierUpdateRestockItem(it.id, done ? it.quantity : qty, done);
      if (res.error) { toast(res.error, false); return; }
      toast('Progress saved.');
      router.refresh();
    });
  }

  return (
    <div>
      <button className="btn-secondary text-xs" onClick={() => setOpen(!open)}>
        {open ? 'Hide line items' : `Show ${items.length} line items`}
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="text-muted"><tr className="text-left">
              <th className="py-1">Style</th><th>Code</th><th>Colour</th><th>Length</th><th>Cap</th><th>Density</th>
              <th>Ordered</th><th>Completed</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-beige/60">
                  <td className="py-1.5 font-medium">{it.style_name}</td>
                  <td>{it.supplier_style_code ?? '-'}</td>
                  <td>{it.colour ?? '-'}</td>
                  <td>{it.length ?? '-'}</td>
                  <td>{it.cap_size ?? '-'}</td>
                  <td>{it.density ?? '-'}</td>
                  <td className="tabular-nums">{it.quantity}</td>
                  <td>
                    <input
                      type="number" min={0} max={it.quantity}
                      className="input text-xs w-16 py-0.5"
                      value={edits[it.id] ?? String(it.qty_completed)}
                      onChange={(e) => setEdits({ ...edits, [it.id]: e.target.value })}
                    />
                  </td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 ring-1 ${it.status === 'complete' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : it.status === 'in_production' ? 'bg-violet-50 text-violet-700 ring-violet-200' : 'bg-sand text-ink ring-beige'}`}>
                      {it.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <button className="btn-secondary text-xs mr-1" disabled={pending} onClick={() => save(it)}>Save</button>
                    <button className="btn-primary text-xs" disabled={pending || it.status === 'complete'} onClick={() => save(it, true)}>All done</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
