'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/constants';

const STAFF_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/orders', label: 'Production Orders' },
  { href: '/orders/new', label: 'Add Order' },
  { href: '/inbox', label: 'Messages' },
  { href: '/qc', label: 'QC Queue' },
  { href: '/customer-updates', label: 'Customer Updates' },
  { href: '/product-mappings', label: 'Product Mapping' },
];
// Billing is admin-only (not staff).
const ADMIN_LINKS = [
  { href: '/billing', label: 'Billing' },
  { href: '/settings/users', label: 'Users & Settings' },
];
const SUPPLIER_LINKS = [{ href: '/supplier', label: 'My Orders' }];

export function Nav({ role }: { role: Role }) {
  const pathname = usePathname();
  const links =
    role === 'supplier'
      ? SUPPLIER_LINKS
      : role === 'admin'
      ? [...STAFF_LINKS, ...ADMIN_LINKS]
      : STAFF_LINKS;

  return (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const active = pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? 'bg-ink text-cream' : 'text-ink hover:bg-sand'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
