import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const COMPETITORS = [
  { name: 'ChargeUp (main)', note: 'No public pricing, vague venue terms — beat with transparency' },
  { name: 'Chargeroo', note: '$7.50/hr + $20 deposit — WAAVA is ~half price, $0 deposit' },
  { name: 'MeCharge', note: 'AU on-demand charging network' },
  { name: 'Brick', note: 'Global franchise model, present in AU' },
];

export default async function WaavaResearchPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Marketing Research" subtitle="Competitor intel · market & venue prioritisation" />
      <div className="card p-4 mb-4 text-sm text-muted">
        Focus: track competitor pricing/coverage, prioritise launch cities &amp; venue categories,
        and surface chain/group targets for bulk rollouts. WAAVA&apos;s edge is transparency + price.
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {COMPETITORS.map((c) => (
          <div key={c.name} className="card p-4">
            <div className="font-medium text-sm">{c.name}</div>
            <p className="text-sm text-muted mt-1">{c.note}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-4">Scaffold. Full intel: <code>~/waava-brain/knowledge/competitors.md</code>. <Link href="/waava" className="text-honey hover:underline">← WAAVA home</Link></p>
    </>
  );
}
