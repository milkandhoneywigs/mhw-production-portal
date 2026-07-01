'use client';
import { useState, useTransition } from 'react';
import { submitQc } from '@/app/actions/qc';

const CHECKS: { name: string; label: string }[] = [
  { name: 'correct_style', label: 'Correct style' },
  { name: 'correct_colour', label: 'Correct colour' },
  { name: 'correct_length', label: 'Correct length' },
  { name: 'correct_cap_size', label: 'Correct cap size' },
  { name: 'correct_density', label: 'Correct density' },
  { name: 'lace_checked', label: 'Lace checked' },
  { name: 'no_visible_faults', label: 'No visible faults' },
];

// QC checklist. All checks pass -> qc_passed. Any unchecked -> manager_review_required.
export function QcForm({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <form className="mt-3 border-t border-beige pt-3" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => {
        const res = await submitQc(orderId, fd);
        if ('error' in res) setResult(res.error ?? 'Something went wrong');
        else setResult(res.passed ? 'QC PASSED — moved to Ready to dispatch stage' : 'QC FAILED — sent to manager review');
      });
    }}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {CHECKS.map((c) => (
          <label key={c.name} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={c.name} className="rounded border-beige text-honey focus:ring-honey/40" />
            {c.label}
          </label>
        ))}
      </div>
      <textarea name="notes" rows={2} className="input text-sm mb-2" placeholder="QC notes (required if failing)…" />
      <div className="flex items-center gap-3">
        <button className="btn-primary text-xs" disabled={pending}>{pending ? 'Submitting…' : 'Submit QC'}</button>
        {result && <span className="text-xs font-medium">{result}</span>}
      </div>
    </form>
  );
}
