'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createTask, setTaskStatus } from '@/app/actions/command-centre';

interface AgentOpt { id: string; name: string }

// Quick-add form for the task system.
export function TaskQuickAdd({ agents }: { agents: AgentOpt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErr(null);
    start(async () => {
      const res = await createTask(fd);
      if (res.error) setErr(res.error);
      else { form.reset(); router.refresh(); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card p-4 mb-5">
      <div className="grid md:grid-cols-6 gap-2 items-end">
        <div className="md:col-span-2">
          <label className="label">New task</label>
          <input name="title" required className="input" placeholder="What needs doing?" />
        </div>
        <div>
          <label className="label">Agent</label>
          <select name="agent_id" className="input" defaultValue="">
            <option value="">Unassigned</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Module</label>
          <select name="source_module" className="input" defaultValue="command_centre">
            {['production', 'customer_service', 'seo', 'marketing', 'inventory', 'finance', 'partnerships', 'command_centre', 'other'].map((m) => (
              <option key={m} value={m}>{m.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="input" defaultValue="medium">
            {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Adding…' : 'Add task'}</button>
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </form>
  );
}

// Status controls on each task card.
export function TaskActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const move = (next: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled') =>
    start(async () => { await setTaskStatus(id, next); router.refresh(); });

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {status !== 'in_progress' && status !== 'done' && <button className="btn-secondary text-[11px] px-2 py-0.5" disabled={pending} onClick={() => move('in_progress')}>Start</button>}
      {status !== 'blocked' && status !== 'done' && <button className="btn-secondary text-[11px] px-2 py-0.5" disabled={pending} onClick={() => move('blocked')}>Block</button>}
      {status !== 'done' && <button className="btn-primary text-[11px] px-2 py-0.5" disabled={pending} onClick={() => move('done')}>Done</button>}
      {status === 'done' && <button className="btn-secondary text-[11px] px-2 py-0.5" disabled={pending} onClick={() => move('todo')}>Reopen</button>}
    </div>
  );
}
