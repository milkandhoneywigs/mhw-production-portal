'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createIdeaPlan } from '@/app/actions/command-centre';

// The owner's idea box: type a thought, get back an agent-orchestrated business
// plan (generated on the Mac Studio, grounded in the business brain + live data).
export function IdeaBox() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErr(null); setMsg(null);
    start(async () => {
      const res = await createIdeaPlan(fd);
      if (res.error) setErr(res.error);
      else {
        setMsg('Your Chief of Staff is on it — the plan lands below in a few minutes, with each agent assigned their role and tasks.');
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card p-5 bg-gradient-to-br from-white to-honey/5 ring-1 ring-honey/30">
      <textarea
        name="idea"
        rows={2}
        required
        className="input text-sm"
        placeholder={'Type an idea… e.g. "I want to expand internationally" · "Launch a bridal wig line" · "Open a second showroom in Melbourne"'}
      />
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-muted">Your idea becomes a grounded business plan — phases, each agent&apos;s role, budgets, risks, first 7 days — and seeds their task boards.</p>
        <button type="submit" className="btn-primary whitespace-nowrap ml-3" disabled={pending}>{pending ? 'Sending…' : 'Build the plan'}</button>
      </div>
      {msg && <p className="text-xs text-emerald-700 mt-2">{msg}</p>}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </form>
  );
}
