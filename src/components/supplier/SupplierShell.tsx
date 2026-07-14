'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SupplierSection } from '@/lib/supplier-portal';

// Supplier navigation shell: persistent sidebar on desktop, hamburger sheet on
// mobile. Badge counts arrive from the server layout.
export function SupplierShell({
  sections, counts, profileName, children,
}: {
  sections: SupplierSection[];
  counts: Record<string, number>;
  profileName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      <Link
        href="/supplier"
        onClick={() => setOpen(false)}
        className={`rounded-lg px-3 py-2 text-sm font-medium transition flex items-center gap-2 ${
          pathname === '/supplier' ? 'bg-ink text-cream' : 'text-ink hover:bg-sand'
        }`}
      >
        <span aria-hidden>🏠</span> Dashboard
      </Link>
      {sections.map((s) => {
        const active = pathname.startsWith(s.href);
        const count = counts[s.href] ?? 0;
        return (
          <Link
            key={s.href}
            href={s.href}
            onClick={() => setOpen(false)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition flex items-center gap-2 ${
              active ? 'bg-ink text-cream' : 'text-ink hover:bg-sand'
            }`}
          >
            <span aria-hidden>{s.icon}</span>
            <span className="flex-1">{s.label}</span>
            {count > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-honey text-white text-[11px] font-semibold grid place-items-center">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="mt-auto pt-4 border-t border-beige">
      <div className="px-2 text-sm font-medium truncate">{profileName}</div>
      <div className="px-2 text-xs text-muted uppercase tracking-wide mb-2">Supplier</div>
      <form action="/auth/signout" method="post">
        <button className="btn-secondary w-full text-xs" type="submit">Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen md:flex">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-beige bg-cream px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Link href="/supplier"><img src="/mh-logo.webp" alt="Milk & Honey" className="w-32 h-auto" /></Link>
        <button
          className="btn-secondary text-sm px-3"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          aria-expanded={open}
        >
          ☰ Menu
        </button>
      </div>
      {open && (
        <div className="md:hidden fixed inset-0 z-20 bg-ink/30" onClick={() => setOpen(false)}>
          <aside
            className="absolute top-[57px] left-0 right-0 border-b border-beige bg-cream p-4 flex flex-col gap-2 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {nav}
            {account}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-beige bg-gradient-to-b from-cream to-sand/40 p-4 flex-col">
        <Link href="/supplier" className="block px-1 mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mh-logo.webp" alt="Milk & Honey" className="w-40 h-auto mt-1" />
        </Link>
        <div className="px-1 mb-6 text-[10px] uppercase tracking-[0.2em] text-honey font-semibold">Supplier Portal</div>
        {nav}
        {account}
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
