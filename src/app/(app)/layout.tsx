import { requireProfile } from '@/lib/auth';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-beige bg-cream/60 p-4 flex flex-col">
        <div className="px-2 mb-6">
          <div className="text-base font-semibold tracking-tight">Milk &amp; Honey</div>
          <div className="text-xs text-muted">Production Portal</div>
        </div>
        <Nav role={profile.role} />
        <div className="mt-auto pt-4 border-t border-beige">
          <div className="px-2 text-sm font-medium truncate">{profile.full_name || profile.email}</div>
          <div className="px-2 text-xs text-muted uppercase tracking-wide mb-2">{profile.role}</div>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary w-full text-xs" type="submit">Sign out</button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="max-w-[1400px] mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
