'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { replyToCommand } from '@/app/actions/command-centre';

// Thread reply box: continue working with the agent inside the same command.
export function CommandReply({ commandId, status }: { commandId: string; status: string }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const busy = ['queued', 'claimed', 'running'].includes(status);

  if (busy) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted mt-3">
        <span className="w-2 h-2 rounded-full bg-honey animate-pulse" />
        The agent is working on this thread — replies open again when it reports back.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSent(false); }}
        rows={3}
        placeholder="Reply to your agent — continue the project in this thread…"
        className="w-full rounded-xl border border-beige bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-honey/40"
      />
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={() => startTransition(async () => {
            setError(null);
            const res = await replyToCommand(commandId, text);
            if (res.error) { setError(res.error); return; }
            setText(''); setSent(true); router.refresh();
          })}
          disabled={pending || !text.trim()}
          className="rounded-lg bg-ink text-cream text-sm font-medium px-4 py-2 hover:bg-ink/85 transition disabled:opacity-40"
        >
          {pending ? 'Sending…' : 'Send reply'}
        </button>
        {sent && <span className="text-xs text-emerald-700">Sent — the agent picks it up within ~15 seconds and answers in this thread.</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
