import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STAGES = ['Prospect', 'Contacted', 'Interested', 'Agreed', 'Installed', 'Live'];

const TARGET_TIERS = [
  { tier: '1 · Long dwell + phone-heavy', ex: 'Pubs, bars, clubs, breweries, hotels, restaurants, cafes, gyms, salons, clinics, unis, co-working' },
  { tier: '2 · High foot traffic', ex: 'Shopping centres, airports, transport hubs, cinemas, entertainment & event venues' },
  { tier: '3 · Coverage gaps', ex: 'Suburbs/areas with no nearby WAAVA station — fill the map (network effect)' },
  { tier: '4 · Chains & groups', ex: 'Pub groups, gym chains, hotel groups, mall operators → one deal, many stations (bulk)' },
];

export default async function WaavaProspectingPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Venue Prospecting" subtitle="B2B venue acquisition · suggest-only pipeline" />

      <div className="card p-4 mb-5 text-sm text-muted">
        <strong>The pitch:</strong> zero cost, zero install, <strong>20% of rental revenue</strong>, we
        supply &amp; maintain. Lead with transparency (ChargeUp hides its terms; we show the 20% + an
        earnings estimate). Agent builds &amp; scores target lists and drafts outreach; <strong>you
        approve &amp; send.</strong>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {STAGES.map((s) => (
          <div key={s} className="card p-3 text-center">
            <div className="text-[11px] uppercase tracking-wide text-muted">{s}</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">0</div>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Target tiers (priority order)</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {TARGET_TIERS.map((t) => (
          <div key={t.tier} className="card p-4">
            <div className="font-medium text-sm">{t.tier}</div>
            <p className="text-sm text-muted mt-1">{t.ex}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted mt-5">
        Scaffold — pipeline counts are placeholders until the venue data source / CRM is connected.
        Agent spec &amp; outputs: <code>~/waava-brain/arms/prospecting</code>.
        <Link href="/waava" className="text-honey hover:underline ml-2">← WAAVA home</Link>
      </p>
    </>
  );
}
