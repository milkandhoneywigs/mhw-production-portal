'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCommand } from '@/app/actions/command-centre';
import { COMMAND_TYPE_OPTIONS, PRIORITY_OPTIONS, EXEC_TARGET_OPTIONS } from '@/lib/command-centre/cc';

interface AgentOpt { id: string; name: string; status: string }

// The owner's command box: pick an agent, type an instruction, choose type +
// priority + target, submit. Saves a QUEUED command in Supabase for the Mac
// Studio runner. Nothing executes here.
export function CommandComposer({ agents, placeholder }: { agents: AgentOpt[]; placeholder?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null); setOk(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await createCommand(fd);
      if (res.error) setErr(res.error);
      else {
        setOk('Queued to Mac Studio. Your runner will pick it up.');
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Agent</label>
          <select name="agent_id" className="input" defaultValue={agents[0]?.id ?? ''}>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.status !== 'active' ? ` (${a.status})` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Command type</label>
          <select name="command_type" className="input" defaultValue="analyse">
            {COMMAND_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Instruction</label>
        <textarea name="prompt" rows={4} required className="input font-mono text-sm"
          placeholder={placeholder ?? 'e.g. Summarise today\'s production risks and anything blocking a shipment.'} />
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="label">Priority</label>
          <select name="priority" className="input" defaultValue="medium">
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Execution target</label>
          <select name="execution_target" className="input" defaultValue="mac_studio">
            {EXEC_TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? 'Sending…' : 'Send to Mac Studio'}
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      <p className="text-xs text-muted">Commands are saved to Supabase as <b>QUEUED</b> — the portal never runs anything itself.</p>
    </form>
  );
}
