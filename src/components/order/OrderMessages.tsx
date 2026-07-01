'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { postOrderMessage } from '@/app/actions/messages';
import type { OrderMessage } from '@/lib/types';

// Two-way message thread on an order. Staff request updates; supplier replies.
export function OrderMessages({
  orderId, messages, meId, compact = false,
}: { orderId: string; messages: OrderMessage[]; meId?: string; compact?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();

  function send() {
    if (!body.trim()) return;
    start(async () => {
      await postOrderMessage(orderId, body);
      setBody('');
      router.refresh();
    });
  }

  const thread = (
    <div className={`space-y-2 ${compact ? 'max-h-56' : 'max-h-80'} overflow-y-auto mb-3`}>
      {messages.length === 0 ? (
        <p className="text-sm text-muted">No messages yet. Start the conversation.</p>
      ) : (
        messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-ink text-cream' : 'bg-sand text-ink'}`}>
                <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">
                  {m.sender_name} · {m.sender_role} · {new Date(m.created_at).toLocaleString('en-AU')}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const input = (
    <div className="flex gap-2">
      <textarea className="input text-sm flex-1" rows={2} placeholder="Message the supplier / staff…"
        value={body} onChange={(e) => setBody(e.target.value)} />
      <button className="btn-primary" disabled={pending || !body.trim()} onClick={send}>{pending ? 'Sending…' : 'Send'}</button>
    </div>
  );

  if (compact) return <div className="mt-3 border-t border-beige pt-3">{thread}{input}</div>;
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Messages (supplier ↔ team)</h2>
      {thread}
      {input}
    </div>
  );
}
