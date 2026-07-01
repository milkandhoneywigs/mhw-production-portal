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
  const bellHref = profile.role === 'supplier' ? '/supplier' : '/orders';

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-beige bg-cream/60 p-4 flex flex-col">
        <div className="px-2 mb-6 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold tracking-tight">Milk &amp; Honey</div>
            <div className="text-xs text-muted">Production Portal</div>
          </div>
          <Link href={bellHref} className="relative inline-flex" title="New messages">
            <span className="text-lg">🔔</span>
            {notif > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold grid place-items-center">
                {notif}
              </span>
            )}
          </Link>
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
