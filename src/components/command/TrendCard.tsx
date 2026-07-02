// Fresha-style KPI card: big value + green/red % badge vs the comparison period.
// Server component (pure render).

export function TrendBadge({ change }: { change: number | null }) {
  if (change == null) return <span className="text-[11px] text-muted">vs comp period —</span>;
  const up = change >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" className={up ? '' : 'rotate-180'} aria-hidden>
        <path d="M5 1 L9 7 L1 7 Z" fill="currentColor" />
      </svg>
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function TrendCard({
  label, value, change, sub, big = false,
}: { label: string; value: string; change: number | null; sub?: string; big?: boolean }) {
  return (
    <div className="card p-4 hover:shadow-md transition h-full flex flex-col">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`${big ? 'text-3xl' : 'text-2xl'} font-semibold tabular-nums mt-1 text-ink`}>{value}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <TrendBadge change={change} />
        <span className="text-[11px] text-muted">vs comp period</span>
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
