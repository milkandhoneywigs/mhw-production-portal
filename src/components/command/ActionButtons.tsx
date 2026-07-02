'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markDemoCompleted, decideApproval, updateRiskStatus } from '@/app/actions/command-centre';

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | void>) =>
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) setErr(res.error);
      else router.refresh();
    });
  return { pending, err, run };
}

// Admin/dev-only: simulate the runner completing a command to test the UI.
export function DemoCompleteButton({ commandId, disabled }: { commandId: string; disabled?: boolean }) {
  const { pending, err, run } = useRun();
  return (
    <div>
      <button className="btn-secondary text-xs" disabled={pending || disabled}
        onClick={() => run(() => markDemoCompleted(commandId))}>
        {pending ? 'Working…' : 'Mark demo completed'}
      </button>
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
}

export function ApprovalActions({ id }: { id: string }) {
  const { pending, err, run } = useRun();
  const [note, setNote] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note (optional)" className="input text-xs" />
      <div className="flex gap-2">
        <button className="btn-primary text-xs" disabled={pending} onClick={() => run(() => decideApproval(id, 'approved', note || undefined))}>Approve</button>
        <button className="btn-secondary text-xs" disabled={pending} onClick={() => run(() => decideApproval(id, 'rejected', note || undefined))}>Reject</button>
        <button className="btn-secondary text-xs" disabled={pending} onClick={() => run(() => decideApproval(id, 'snoozed', note || undefined))}>Snooze</button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

export function RiskActions({ id }: { id: string }) {
  const { pending, err, run } = useRun();
  return (
    <div className="flex gap-2">
      <button className="btn-secondary text-xs" disabled={pending} onClick={() => run(() => updateRiskStatus(id, 'acknowledged'))}>Acknowledge</button>
      <button className="btn-primary text-xs" disabled={pending} onClick={() => run(() => updateRiskStatus(id, 'resolved'))}>Resolve</button>
      <button className="btn-secondary text-xs" disabled={pending} onClick={() => run(() => updateRiskStatus(id, 'dismissed'))}>Dismiss</button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
