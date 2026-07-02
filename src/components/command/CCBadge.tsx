import type { Tone } from '@/lib/command-centre/cc';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-sand text-ink ring-beige',
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  honey: 'bg-honey/10 text-honey ring-honey/40',
};

export function CCBadge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
