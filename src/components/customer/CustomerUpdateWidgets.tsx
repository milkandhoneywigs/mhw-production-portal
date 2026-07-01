'use client';
import { useState, useTransition } from 'react';
import { createCustomerUpdateDraft, setCustomerUpdateStatus } from '@/app/actions/customer-updates';
import { CUSTOMER_UPDATE_MILESTONES } from '@/lib/business/customer-update';
import type { CustomerUpdate, CustomerUpdateType } from '@/lib/types';

// Create a new draft update for an order (select milestone).
export function NewDraftForm({ orders }: { orders: { id: string; order_number: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <form className="card p-4 flex flex-wrap items-end gap-3" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(() => createCustomerUpdateDraft(fd.get('order_id')!.toString(), fd.get('type') as CustomerUpdateType).then(() => {}));
    }}>
      <div><label className="label">Order</label>
        <select name="order_id" className="input" required>
          <option value="">Select…</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
        </select>
      </div>
      <div><label className="label">Milestone</label>
        <select name="type" className="input">
          {CUSTOMER_UPDATE_MILESTONES.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? 'Creating…' : 'Create draft'}</button>
    </form>
  );
}

// A single draft/approved update: editable message + approve / mark sent / skip.
export function CustomerUpdateRow({ u, orderNumber }: { u: CustomerUpdate; orderNumber: string }) {
  const [msg, setMsg] = useState(u.message ?? '');
  const [pending, start] = useTransition();
  const act = (status: 'approved' | 'sent' | 'skipped') =>
    start(() => setCustomerUpdateStatus(u.id, status, msg).then(() => {}));

  const toneChip =
    u.status === 'sent' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : u.status === 'approved' ? 'bg-blue-50 text-blue-700 ring-blue-200'
    : u.status === 'skipped' ? 'bg-gray-100 text-gray-500 ring-gray-200'
    : 'bg-amber-50 text-amber-800 ring-amber-200';

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{orderNumber} — <span className="capitalize">{u.update_type.replace(/_/g, ' ')}</span></div>
        <span className={`chip ${toneChip}`}>{u.status.toUpperCase()}</span>
      </div>
      <div className="text-sm font-medium text-muted mb-1">{u.subject}</div>
      <textarea className="input text-sm" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)}
        disabled={u.status === 'sent' || u.status === 'skipped'} />
      {(u.status === 'draft' || u.status === 'approved') && (
        <div className="flex gap-2 mt-2">
          {u.status === 'draft' && <button className="btn-secondary text-xs" disabled={pending} onClick={() => act('approved')}>Approve</button>}
          <button className="btn-primary text-xs" disabled={pending} onClick={() => act('sent')}>Mark sent</button>
          <button className="btn-secondary text-xs" disabled={pending} onClick={() => act('skipped')}>Skip</button>
        </div>
      )}
      <p className="text-xs text-muted mt-2">v1 records the action only. No email is sent automatically.</p>
    </div>
  );
}
