'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOpportunityStatus } from '@/app/actions/command-centre';

export function OpportunityActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (next: 'approved' | 'in_progress' | 'completed' | 'dismissed') =>
    start(async () => { await setOpportunityStatus(id, next); router.refresh(); });

  return (
    <div className="flex flex-wrap gap-1">
      {status === 'suggested' && <button className="btn-primary text-[11px] px-2 py-0.5" disabled={pending} onClick={() => move('approved')}>Approve</button>}
      {(status === 'suggested' || status === 'approved') && <button className="btn-secondary text-[11px] px-2 py-0.5" disabled={pending} onClick={() => move('in_progress')}>Start</button>}
      {status === 'in_progress' && <button className="btn-primary text-[11px] px-2 py-0.5" disabled={pending} onClick={() => move('completed')}>Complete</button>}
      {status !== 'completed' && status !== 'dismissed' && <button className="btn-secondary text-[11px] px-2 py-0.5" disabled={pending} onClick={() => move('dismissed')}>Dismiss</button>}
    </div>
  );
}
