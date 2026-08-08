import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { createServiceClient } from '@/lib/supabase/service';
import { ByState, ByCategory, Funnel } from '@/components/waava/Charts';
import { ProspectBrowser, type Venue } from '@/components/waava/ProspectBrowser';
import { SignedOnPartners } from '@/components/waava/SignedOnPartners';

export const dynamic = 'force-dynamic';

const CAT_LABEL: Record<string, string> = {
  bar: 'Bars', pub: 'Pubs', nightclub: 'Clubs', restaurant: 'Restaurants', cafe: 'Cafes', gym: 'Gyms',
  hotel: 'Hotels', hospital: 'Hospitals', university: 'Universities', train_station: 'Train stations',
  stadium: 'Stadiums', theatre: 'Theatres', arts_centre: 'Arts centres', events_venue: 'Event venues',
  airport: 'Airports', shopping_mall: 'Shopping malls',
};
const label = (c: string) => CAT_LABEL[c] || c;
const B = '/command-centre/waava/prospecting';
const COLS = 'id,name,category,tier,state,city,address,phone,email,website,stage,contacted,assigned_to,notes,registered_for_launch,signed_on,device';

export default async function WaavaProspectingPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; cat?: string; email?: string; tier?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const svc = createServiceClient();

  const { data: summary } = await svc.rpc('waava_summary');
  const s = summary || { total: 0, premium: 0, standard: 0, with_phone: 0, with_email: 0, contactable: 0, by_state: [], by_category: [], funnel: { prospects: 0, contacted: 0, registered: 0, signed: 0 } };

  let q = svc.from('waava_venues').select(COLS, { count: 'exact' });
  if (sp.tier) q = q.eq('tier', sp.tier);
  if (sp.state) q = q.eq('state', sp.state);
  if (sp.cat) q = q.eq('category', sp.cat);
  if (sp.email === '1') q = q.not('email', 'is', null);
  const { data: venues, count } = await q.order('state').order('name').limit(300);

  const { data: signed } = await svc.from('waava_venues').select(COLS).eq('signed_on', true).order('state');
  const { data: staffRows } = await svc.from('profiles').select('full_name,email,role').in('role', ['admin', 'staff']);
  const staff = (staffRows || []).map((p: { full_name: string | null; email: string }) => p.full_name || p.email);

  const byCatStd = (s.by_category as { name: string; value: number; tier: string }[]).filter((c) => c.tier === 'standard').map((c) => ({ name: label(c.name), value: c.value }));
  const byCatPrem = (s.by_category as { name: string; value: number; tier: string }[]).filter((c) => c.tier === 'premium').map((c) => ({ name: label(c.name), value: c.value }));
  const funnelData = [
    { name: 'Prospects', value: s.funnel.prospects }, { name: 'Contacted', value: s.funnel.contacted },
    { name: 'Registered', value: s.funnel.registered }, { name: 'Signed on', value: s.funnel.signed },
  ];

  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ state: sp.state, cat: sp.cat, email: sp.email, tier: sp.tier, ...o }).forEach(([k, v]) => { if (v) p.set(k, v); });
    const str = p.toString(); return str ? `?${str}` : '';
  };
  const STAT = [
    { k: 'Total venues', v: s.total }, { k: 'Premium', v: s.premium }, { k: 'With phone', v: s.with_phone },
    { k: 'With email', v: s.with_email }, { k: 'Signed on', v: s.funnel.signed },
  ];
  const TIERS = [{ k: '', label: 'All' }, { k: 'standard', label: 'Standard' }, { k: 'premium', label: '💎 Premium' }];

  if (!s.total) {
    return (
      <>
        <PageHeader title="Venue Prospecting" subtitle="Live Australian venue database" />
        <div className="card p-6 text-sm text-muted">The venue database is being loaded — refresh shortly.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Venue Prospecting" subtitle="Live Australian venue database · suggest-only outreach" />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {STAT.map((x) => (
          <div key={x.k} className="card p-4 text-center">
            <div className="text-2xl font-semibold tabular-nums">{Number(x.v).toLocaleString()}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted mt-1">{x.k}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-4"><h3 className="text-sm font-semibold mb-3">Venues by state</h3><ByState data={s.by_state} /></div>
        <div className="card p-4"><h3 className="text-sm font-semibold mb-3">Outreach funnel</h3><Funnel data={funnelData} /></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-4"><h3 className="text-sm font-semibold mb-3">Standard venues by type</h3><ByCategory data={byCatStd} /></div>
        <div className="card p-4"><h3 className="text-sm font-semibold mb-3">💎 Premium venues by type</h3><ByCategory data={byCatPrem} /></div>
      </div>

      {/* signed-on partners */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">✅ Signed-on partners <span className="text-honey">({(signed || []).length})</span></h2>
      <div className="mb-8"><SignedOnPartners venues={(signed || []) as Venue[]} /></div>

      {/* browse + filter */}
      <div className="flex items-center flex-wrap gap-2 mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mr-1">Browse &amp; work prospects</h2>
        <div className="flex gap-1 mr-1">
          {TIERS.map((t) => <Link key={t.label} href={`${B}${qs({ tier: t.k || undefined })}`} className={`text-xs px-2.5 py-1 rounded ${(sp.tier || '') === t.k ? 'bg-ink text-cream' : 'card'}`}>{t.label}</Link>)}
        </div>
        <Link href={B} className={`text-xs px-2 py-1 rounded ${!sp.state && !sp.cat && !sp.email && !sp.tier ? 'bg-ink text-cream' : 'card'}`}>Reset</Link>
        {sp.state && <Link href={`${B}${qs({ state: undefined })}`} className="text-xs px-2 py-1 rounded card">{sp.state} ✕</Link>}
        {sp.cat && <Link href={`${B}${qs({ cat: undefined })}`} className="text-xs px-2 py-1 rounded card">{label(sp.cat)} ✕</Link>}
        <Link href={`${B}${qs({ email: sp.email === '1' ? undefined : '1' })}`} className={`text-xs px-2 py-1 rounded ${sp.email === '1' ? 'bg-ink text-cream' : 'card'}`}>Has email</Link>
        <span className="text-xs text-muted ml-auto">{(count || 0).toLocaleString()} match · showing {(venues || []).length} · click a row to open</span>
      </div>
      <ProspectBrowser venues={(venues || []) as Venue[]} staff={staff} />

      <p className="text-xs text-muted mt-4">Click any venue to add notes, mark contacted, assign an owner, or sign them on + pick a device. <Link href="/command-centre/waava" className="text-honey hover:underline ml-1">← WAAVA home</Link></p>
    </>
  );
}
