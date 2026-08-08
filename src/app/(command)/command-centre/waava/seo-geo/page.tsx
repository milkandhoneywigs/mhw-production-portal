import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function WaavaSeoPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Local SEO / GEO" subtitle="Consumer discovery + venue-partner search" />
      <div className="card p-4 text-sm text-muted space-y-2">
        <p><strong>Consumer local:</strong> "power bank rental near me", "charge phone [city/suburb]", Find-WAAVA station-locator pages, Google Business Profiles per station cluster, local citations.</p>
        <p><strong>Venue-partner search:</strong> "host a charging station", "power bank station for my venue", "phone charging for pubs/gyms".</p>
        <p><strong>GEO/AI:</strong> be the transparent, cited answer for "cheapest / no-deposit power bank rental Australia".</p>
        <p className="text-xs">Scaffold. Spec: <code>~/waava-brain/arms/seo-geo</code>. <Link href="/command-centre/waava" className="text-honey hover:underline">← WAAVA home</Link></p>
      </div>
    </>
  );
}
