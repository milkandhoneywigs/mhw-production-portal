import { requireSupplier } from '@/lib/auth';
import { visibleSections } from '@/lib/supplier-portal';
import { fetchBadgeCounts } from '@/lib/supplier-data';
import { SupplierShell } from '@/components/supplier/SupplierShell';
import { Toaster } from '@/components/supplier/Feedback';

// The whole /supplier tree is supplier-only. Staff/admin land on /dashboard.
export const dynamic = 'force-dynamic';

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireSupplier();
  const counts = await fetchBadgeCounts(profile.id);

  return (
    <SupplierShell
      sections={visibleSections()}
      counts={counts}
      profileName={profile.full_name || profile.email || 'Supplier'}
    >
      {children}
      <Toaster />
    </SupplierShell>
  );
}
