import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const AGENTS = [
  {
    slug: 'prospecting',
    name: 'Venue Prospecting',
    tag: 'Lead engine',
    desc: 'B2B venue acquisition — find, qualify and prioritise venues, then draft outreach. Station density is the flywheel.',
    href: '/command-centre/waava/prospecting',
  },
  {
    slug: 'seo-geo',
    name: 'Local SEO / GEO',
    tag: 'Discovery',
    desc: '"power bank rental near me / [city]", Find-WAAVA locator pages, and "host a charging station" venue keywords.',
    href: '/command-centre/waava/seo-geo',
  },
  {
    slug: 'marketing-research',
    name: 'Marketing Research',
    tag: 'Intel',
    desc: 'Competitor tracking (ChargeUp opacity vs WAAVA transparency), venue-category & city prioritisation, chain targets.',
    href: '/command-centre/waava/marketing-research',
  },
];

export default async function WaavaPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="🌊 WAAVA" subtitle="Portable power-bank rental network · agent command area" />

      <div className="card p-4 mb-5 text-sm text-muted">
        A separate business from Milk &amp; Honey. Agents here are <strong>suggest-only</strong> —
        every venue outreach, SEO change and ad is drafted for your approval before anything goes out.
        The wedge: <strong>radical transparency</strong> — public $4/hr, $15/day cap, $0 deposit, no app;
        venues earn <strong>20% at $0 cost</strong>. Beat competitor opacity with clarity.
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {AGENTS.map((a) => (
          <Link key={a.slug} href={a.href} className="card p-5 hover:shadow-md transition block">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{a.name}</div>
              <span className="text-[10px] uppercase tracking-wide rounded-full bg-sand px-2 py-0.5">{a.tag}</span>
            </div>
            <p className="text-sm text-muted mt-2">{a.desc}</p>
            <div className="text-honey text-sm mt-3">Open →</div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted mt-5">
        Scaffold. Knowledge base + agent specs live in <code>~/waava-brain</code>. Live site
        (waava.com.au, on Lovable) connects once the GitHub repo is linked.
      </p>
    </>
  );
}
