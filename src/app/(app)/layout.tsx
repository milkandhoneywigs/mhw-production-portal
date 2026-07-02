import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  // Notification bell: count orders whose LATEST message is from the other party
  // (a simple unread approximation — a full read-state can come later). RLS scopes
  // this to the orders the user can see.
  const supabase = createClient();
  const { data: msgs } = await supabase
    .from('order_messages')
    .select('order_id, sender_role, created_at')
    .order('created_at', { ascending: false });
  const otherRoles = profile.role === 'supplier' ? ['staff', 'admin'] : ['supplier'];
  const seen = new Set<string>();
  let notif = 0;
  for (const m of (msgs ?? []) as { order_id: string; sender_role: string | null }[]) {
    if (seen.has(m.order_id)) continue;
    seen.add(m.order_id);
    if (m.sender_role && otherRoles.includes(m.sender_role)) notif++;
  }
  const bellHref = profile.role === 'supplier' ? '/supplier' : '/inbox';

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-beige bg-gradient-to-b from-cream to-sand/40 p-4 flex flex-col">
        <div className="px-1 mb-1 flex items-start justify-between">
          <Link href={bellHref === '/inbox' ? '/dashboard' : '/supplier'} className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mh-logo.webp" alt="Milk &amp; Honey" className="w-40 h-auto mt-1" />
          </Link>
          <Link href={bellHref} className="relative inline-flex mt-1 text-ink/70 hover:text-ink transition" title="Messages inbox">
            <span className="text-lg">🔔</span>
            {notif > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-honey text-white text-[10px] font-semibold grid place-items-center shadow-sm">
                {notif}
              </span>
            )}
          </Link>
        </div>
        <div className="px-1 mb-6 text-[10px] uppercase tracking-[0.2em] text-honey font-semibold">Production Portal</div>
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
