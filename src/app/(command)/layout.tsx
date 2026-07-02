import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { CommandNav } from '@/components/command/CommandNav';

// Owner/admin ONLY. requireAdmin redirects staff -> /dashboard and suppliers ->
// /supplier, so the entire /command-centre tree is locked to the owner.
export default async function CommandLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-beige bg-gradient-to-b from-cream to-sand/40 p-4 flex flex-col">
        <Link href="/command-centre" className="block px-1 mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mh-logo.webp" alt="Milk & Honey" className="w-40 h-auto" />
        </Link>
        <div className="px-1 mb-6 mt-1 text-[10px] uppercase tracking-[0.18em] text-honey font-semibold leading-tight">
          Beyond Reason<br />Command Centre
        </div>
        <CommandNav />
        <div className="mt-auto pt-4 border-t border-beige">
          <div className="px-2 text-sm font-medium truncate">{profile.full_name || profile.email}</div>
          <div className="px-2 text-xs text-muted uppercase tracking-wide mb-2">Owner</div>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary w-full text-xs" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-[1400px] mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
