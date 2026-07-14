'use client';
import { useEffect, useState } from 'react';

// Tiny app-wide toast bus: any client component calls toast(); the single
// <Toaster /> in the supplier layout renders the stack.
export function toast(message: string, ok = true) {
  window.dispatchEvent(new CustomEvent('mh-toast', { detail: { message, ok } }));
}

interface ToastItem { id: number; message: string; ok: boolean }

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { message, ok } = (e as CustomEvent).detail;
      const id = ++n;
      setItems((prev) => [...prev, { id, message, ok }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4500);
    };
    window.addEventListener('mh-toast', onToast);
    return () => window.removeEventListener('mh-toast', onToast);
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`card px-4 py-3 text-sm shadow-lg border ${t.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}
        >
          {t.ok ? '✓ ' : '✗ '}{t.message}
        </div>
      ))}
    </div>
  );
}

// Confirmation modal for important actions. Renders nothing when closed.
export function ConfirmModal({
  open, title, children, confirmLabel, onConfirm, onClose, pending, danger = false,
}: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string;
  onConfirm: () => void; onClose: () => void; pending?: boolean; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 px-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5 space-y-3 bg-cream" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-ink">{title}</h3>
        <div className="text-sm text-ink/80 space-y-2">{children}</div>
        <div className="flex gap-2 justify-end pt-2">
          <button className="btn-secondary text-sm" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            className={`text-sm ${danger ? 'rounded-lg px-3 py-2 bg-red-600 text-white font-medium hover:bg-red-700' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
