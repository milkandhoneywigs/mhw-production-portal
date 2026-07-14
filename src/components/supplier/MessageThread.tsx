'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { postOrderMessage, markThreadRead } from '@/app/actions/messages';
import { uploadToOrder } from './FileUpload';
import { toast } from './Feedback';
import type { OrderMessage } from '@/lib/types';

// Order-linked conversation thread. Marks itself read on mount; supports text,
// image and PDF attachments. attachmentUrls maps storage paths -> signed URLs
// (resolved server-side).
export function MessageThread({ orderId, messages, meId, attachmentUrls }: {
  orderId: string; messages: OrderMessage[]; meId: string;
  attachmentUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const marked = useRef(false);

  useEffect(() => {
    if (!marked.current) { marked.current = true; void markThreadRead(orderId); }
  }, [orderId]);

  function send() {
    start(async () => {
      setBusy(true);
      let attachment: { path: string; name: string } | undefined;
      if (file) {
        const { path, error } = await uploadToOrder(orderId, file);
        if (error || !path) { toast(`Attachment failed: ${error}`, false); setBusy(false); return; }
        attachment = { path, name: file.name };
      }
      const res = await postOrderMessage(orderId, body, attachment);
      setBusy(false);
      if (res.error) { toast(res.error, false); return; }
      setBody(''); setFile(null);
      void markThreadRead(orderId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="text-sm text-muted">No messages yet — start the conversation below.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          const url = m.attachment_url ? attachmentUrls[m.attachment_url] : null;
          const isImage = m.attachment_name ? /\.(jpe?g|png|webp|heic)$/i.test(m.attachment_name) : false;
          return (
            <div key={m.id} className={`max-w-[85%] ${mine ? 'ml-auto' : ''}`}>
              <div className={`rounded-xl px-3 py-2 text-sm ${mine ? 'bg-honey/20 border border-honey/30' : 'bg-sand border border-beige'}`}>
                <div className="text-[11px] text-muted mb-0.5">
                  {m.sender_name ?? 'Unknown'} · {new Date(m.created_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                {url && (
                  isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.attachment_name ?? 'attachment'} className="mt-1 rounded-lg max-h-48" /></a>
                  ) : (
                    <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs underline">📎 {m.attachment_name}</a>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <textarea
          className="input text-sm" rows={2} placeholder="Write a message…"
          value={body} onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary text-sm" disabled={pending || busy || (!body.trim() && !file)} onClick={send}>
            {busy || pending ? 'Sending…' : 'Send'}
          </button>
          <label className="btn-secondary text-sm cursor-pointer">
            {file ? `📎 ${file.name}` : 'Attach photo / PDF…'}
            <input type="file" className="hidden" accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {file && <button className="text-xs text-muted underline" onClick={() => setFile(null)}>remove</button>}
        </div>
      </div>
    </div>
  );
}
