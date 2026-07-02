'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CC = '/command-centre';
const COMMAND_LINKS = [
  { href: CC, label: 'Owner Dashboard' },
  { href: `${CC}/terminal`, label: 'Terminal' },
  { href: `${CC}/commands`, label: 'Commands' },
  { href: `${CC}/financials`, label: 'Financials' },
  { href: `${CC}/approvals`, label: 'Approvals' },
  { href: `${CC}/agents`, label: 'Agents' },
  { href: `${CC}/risks`, label: 'Risks' },
  { href: `${CC}/tasks`, label: 'Tasks' },
  { href: `${CC}/plans`, label: 'Plans' },
  { href: `${CC}/workers`, label: 'Workers' },
];

// Only Production is live; the rest are planned placeholders.
const MODULES: { label: string; href?: string }[] = [
  { label: 'Production Portal', href: '/production' },
  { label: 'Customer Service' },
  { label: 'SEO' },
  { label: 'Marketing' },
  { label: 'Inventory' },
  { label: 'Finance' },
  { label: 'Partnerships' },
];

export function CommandNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === CC ? pathname === CC : pathname.startsWith(href));

  return (
    <nav className="flex flex-col gap-4">
      <div>
        <div className="px-3 mb-1 text-[10px] uppercase tracking-[0.2em] text-honey font-semibold">Command Centre</div>
        <div className="flex flex-col gap-0.5">
          {COMMAND_LINKS.map((l) => (
            <Link key={l.href} href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive(l.href) ? 'bg-ink text-cream' : 'text-ink hover:bg-sand'}`}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="px-3 mb-1 text-[10px] uppercase tracking-[0.2em] text-honey font-semibold">Modules</div>
        <div className="flex flex-col gap-0.5">
          {MODULES.map((m) =>
            m.href ? (
              <Link key={m.label} href={m.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink hover:bg-sand transition flex items-center justify-between">
                {m.label}<span className="text-[10px] text-emerald-700">OPEN</span>
              </Link>
            ) : (
              <span key={m.label}
                className="rounded-lg px-3 py-1.5 text-sm text-muted flex items-center justify-between cursor-default">
                {m.label}<span className="text-[10px] uppercase tracking-wide text-muted">Planned</span>
              </span>
            ),
          )}
        </div>
      </div>
    </nav>
  );
}
