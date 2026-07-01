import Link from 'next/link';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// A dashboard stat card. `href` makes it a filtered link into the orders list.
export function StatCard({
  label, value, href, tone = 'neutral',
}: { label: string; value: number; href?: string; tone?: 'neutral' | 'warn' | 'danger' | 'good' }) {
  const ring =
    tone === 'danger' ? 'ring-red-200' : tone === 'warn' ? 'ring-amber-200' : tone === 'good' ? 'ring-emerald-200' : 'ring-beige';
  const num =
    tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-ink';
  const inner = (
    <div className={`card p-4 ring-1 ${ring} hover:shadow-md transition`}>
      <div className={`text-2xl font-semibold tabular-nums ${num}`}>{value}</div>
      <div className="text-sm text-muted mt-1 leading-snug">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-sm text-muted">{children}</div>;
}
