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

// Every module opens its agent's workspace; Production also has the full portal.
const MODULES: { label: string; href?: string; tag?: string }[] = [
  { label: 'Production Portal', href: '/production', tag: 'OPEN' },
  { label: 'Customer Service', href: '/command-centre/agents/claudia-customer-service', tag: 'CLAUDIA' },
  { label: 'SEO', href: '/command-centre/agents/seo-agent', tag: 'LIVE' },
  { label: 'Marketing', href: '/command-centre/agents/marketing-agent', tag: 'LIVE' },
  { label: 'Inventory', href: '/command-centre/agents/inventory-agent', tag: 'PLANNED' },
  { label: 'Finance', href: '/command-centre/agents/finance-agent', tag: 'PLANNED' },
  { label: 'Partnerships', href: '/command-centre/agents/partnerships-agent', tag: 'PLANNED' },
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
          {MODULES.map((m) => (
            <Link key={m.label} href={m.href!}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition flex items-center justify-between ${isActive(m.href!) ? 'bg-ink text-cream' : 'text-ink hover:bg-sand'}`}>
              {m.label}
              <span className={`text-[9px] tracking-wide ${m.tag === 'PLANNED' ? 'text-muted' : 'text-emerald-700'}`}>{m.tag}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
