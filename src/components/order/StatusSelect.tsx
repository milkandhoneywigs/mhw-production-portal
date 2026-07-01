'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOrderStatus } from '@/app/actions/orders';
import { READY_MADE_STATUSES, MADE_TO_ORDER_STATUSES, STATUS_LABELS, type OrderStatus, type OrderType } from '@/lib/constants';

// Staff control to move an order to any status in its workflow.
export function StatusSelect({
  orderId, current, orderType,
}: { orderId: string; current: OrderStatus; orderType: OrderType }) {
  const router = useRouter();
  const options = orderType === 'ready_made' ? READY_MADE_STATUSES : MADE_TO_ORDER_STATUSES;
  const [value, setValue] = useState<OrderStatus>(current);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function change(next: OrderStatus) {
    setValue(next);
    start(async () => {
      const res = await setOrderStatus(orderId, next);
      if (res?.error) setErr(res.error);
      else router.refresh(); // refresh so the stage badge + note update immediately
    });
  }

  return (
    <div>
      <label className="label">Advance status</label>
      <select
        className="input"
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as OrderStatus)}
      >
        {options.map((sVal) => (
          <option key={sVal} value={sVal}>{STATUS_LABELS[sVal]}</option>
        ))}
      </select>
      {pending && <p className="text-xs text-muted mt-1">Saving…</p>}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}
