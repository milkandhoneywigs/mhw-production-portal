import type { BadgeTone } from '@/lib/constants';
import { TONE_CLASSES } from '@/lib/constants';

export interface SummaryItem { label: string; value: number | string; tone?: BadgeTone }

// Row of compact stat tiles at the top of each section.
export function SummaryCards({ items }: { items: SummaryItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 mb-6">
      {items.map((it) => (
        <div key={it.label} className="card p-3">
          <div className={`text-2xl font-semibold tabular-nums ${it.tone === 'risk' && Number(it.value) > 0 ? 'text-red-600' : 'text-ink'}`}>
            {it.value}
          </div>
          <div className="text-xs text-muted mt-0.5 leading-tight">{it.label}</div>
        </div>
      ))}
    </div>
  );
}

// Simple percentage bar, e.g. bulk line completion.
export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span>{done} of {total} units completed</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-sand overflow-hidden">
        <div className="h-full rounded-full bg-honey transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Horizontal production progress indicator for made-to-order.
export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2 text-xs">
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'todo';
        return (
          <li key={s} className="flex items-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${
                state === 'done' ? TONE_CLASSES.ready : state === 'now' ? TONE_CLASSES.production : TONE_CLASSES.done
              }`}
            >
              {state === 'done' ? '✓' : state === 'now' ? '●' : '○'} {s}
            </span>
            {i < steps.length - 1 && <span className="mx-1 text-beige">—</span>}
          </li>
        );
      })}
    </ol>
  );
}
