import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import summary from '@/data/waava-summary.json';
import venues from '@/data/waava-venues.json';

export const dynamic = 'force-dynamic';

type Venue = {
  id: string; name: string | null; category: string; state: string; city: string;
  address: string | null; phone: string | null; email: string | null;
  website: string | null; rating: number | null; reviews: number; stage: string;
};

const CAT_LABEL: Record<string, string> = {
  bar: 'Bars', pub: 'Pubs', night_club: 'Clubs', restaurant: 'Restaurants',
  cafe: 'Cafes', gym: 'Gyms', hotel: 'Hotels',
};
const label = (c: string) => CAT_LABEL[c] || c;

export default async function WaavaProspectingPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; cat?: string; email?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const all = venues as Venue[];
  const cats: string[] = summary.categories;
  const states: string[] = summary.states;

  // filtered browse list
  let list = all;
  if (sp.state) list = list.filter((v) => v.state === sp.state);
  if (sp.cat) list = list.filter((v) => v.category === sp.cat);
  if (sp.email === '1') list = list.filter((v) => v.email);
  list = [...list].sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  const shown = list.slice(0, 250);

  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { state: sp.state, cat: sp.cat, email: sp.email, ...o };
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v); });
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  const STAT = [
    { k: 'Total venues', v: summary.total },
    { k: 'With phone', v: summary.with_phone },
    { k: 'With email', v: summary.with_email },
    { k: 'Contactable', v: summary.contactable },
  ];

  return (
    <>
      <PageHeader title="Venue Prospecting" subtitle="B2B venue acquisition · live venue database" />

      <div className="card p-4 mb-5 text-sm text-muted">
        <strong>The pitch:</strong> zero cost, zero install, <strong>20% of rental revenue</strong>, we
        supply &amp; maintain. Lead with transparency (ChargeUp hides its terms; we show the 20%). The
        agent sources every contactable venue in Australia below — <strong>you approve &amp; send.</strong>
      </div>

      {/* headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {STAT.map((s) => (
          <div key={s.k} className="card p-4 text-center">
            <div className="text-2xl font-semibold tabular-nums">{s.v.toLocaleString()}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted mt-1">{s.k}</div>
          </div>
        ))}
      </div>

      {/* per-state x category matrix */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Prospects by state &amp; category</h2>
      <div className="card p-0 mb-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-black/10">
              <th className="p-3 font-medium">State</th>
              {cats.map((c) => <th key={c} className="p-3 font-medium text-right">{label(c)}</th>)}
              <th className="p-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {states.map((st) => {
              const row = (summary.matrix as Record<string, Record<string, number>>)[st];
              return (
                <tr key={st} className="border-b border-black/5 hover:bg-sand/40">
                  <td className="p-3 font-medium">
                    <Link href={`/waava/prospecting${qs({ state: st, cat: undefined })}`} className="hover:text-honey">{st}</Link>
                  </td>
                  {cats.map((c) => (
                    <td key={c} className="p-3 text-right tabular-nums">
                      <Link href={`/waava/prospecting${qs({ state: st, cat: c })}`} className="hover:text-honey">{row[c] || 0}</Link>
                    </td>
                  ))}
                  <td className="p-3 text-right tabular-nums font-semibold">{row.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* browse / filter */}
      <div className="flex items-center flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mr-2">Browse prospects</h2>
        <Link href="/waava/prospecting" className={`text-xs px-2 py-1 rounded ${!sp.state && !sp.cat && !sp.email ? 'bg-ink text-cream' : 'card'}`}>All</Link>
        {sp.state && <span className="text-xs px-2 py-1 rounded card">{sp.state} ✕</span>}
        {sp.cat && <span className="text-xs px-2 py-1 rounded card">{label(sp.cat)} ✕</span>}
        <Link href={`/waava/prospecting${qs({ email: sp.email === '1' ? undefined : '1' })}`} className={`text-xs px-2 py-1 rounded ${sp.email === '1' ? 'bg-ink text-cream' : 'card'}`}>Has email</Link>
        <span className="text-xs text-muted ml-auto">{list.length.toLocaleString()} match · showing {shown.length}</span>
      </div>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-black/10">
              <th className="p-2.5 font-medium">Venue</th>
              <th className="p-2.5 font-medium">Cat</th>
              <th className="p-2.5 font-medium">City</th>
              <th className="p-2.5 font-medium">Phone</th>
              <th className="p-2.5 font-medium">Email</th>
              <th className="p-2.5 font-medium text-right">★</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id} className="border-b border-black/5 hover:bg-sand/40">
                <td className="p-2.5">
                  {v.website ? <a href={v.website} target="_blank" rel="noreferrer" className="font-medium hover:text-honey">{v.name}</a> : <span className="font-medium">{v.name}</span>}
                </td>
                <td className="p-2.5 text-muted">{label(v.category)}</td>
                <td className="p-2.5 text-muted">{v.city}</td>
                <td className="p-2.5 tabular-nums">{v.phone || <span className="text-muted">—</span>}</td>
                <td className="p-2.5">{v.email || <span className="text-muted">—</span>}</td>
                <td className="p-2.5 text-right tabular-nums text-muted">{v.rating ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted mt-4">
        Generated {new Date(summary.generated_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEST ·
        full CSV export at <code>~/waava-brain/arms/prospecting/waava_prospects.csv</code>.
        <Link href="/waava" className="text-honey hover:underline ml-2">← WAAVA home</Link>
      </p>
    </>
  );
}
