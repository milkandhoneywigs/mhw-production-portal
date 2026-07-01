'use client';
import { useState } from 'react';
import { generateSupplierInstructionText } from '@/app/actions/instructions';

// "Generate supplier instruction" button. Generates the supplier-safe text
// server-side (which also logs it), then shows it for copying. No email in v1.
export function InstructionButton({ orderId }: { orderId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    const res = await generateSupplierInstructionText(orderId);
    setLoading(false);
    if (res.text) setText(res.text);
  }

  async function copy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <button onClick={generate} className="btn-primary" disabled={loading}>
        {loading ? 'Generating…' : 'Generate supplier instruction'}
      </button>
      {text && (
        <div className="mt-3">
          <textarea readOnly value={text} rows={16} className="input font-mono text-xs leading-relaxed" />
          <button onClick={copy} className="btn-secondary mt-2">{copied ? 'Copied ✓' : 'Copy to clipboard'}</button>
        </div>
      )}
    </div>
  );
}
