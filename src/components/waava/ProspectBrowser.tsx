'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateVenue, type VenuePatch } from '@/app/(command)/command-centre/waava/actions';

export type Venue = {
  id: string; name: string | null; category: string; tier: string; state: string;
  city: string | null; address: string | null; phone: string | null; email: string | null;
  website: string | null; stage: string; contacted: boolean; assigned_to: string | null;
  notes: string | null; registered_for_launch: boolean; signed_on: boolean; device: string | null;
};

export const STAGES = ['prospect', 'contacted', 'interested', 'agreed', 'installed', 'live'];
export const DEVICES = ['RIPPLE 8', 'RIPPLE 12', 'SWELL 20', 'SURGE 40'];
const CAT_LABEL: Record<string, string> = {
  bar: 'Bar', pub: 'Pub', nightclub: 'Club', restaurant: 'Restaurant', cafe: 'Cafe', gym: 'Gym',
  hotel: 'Hotel', hospital: 'Hospital', university: 'University', train_station: 'Train station',
  stadium: 'Stadium', theatre: 'Theatre', arts_centre: 'Arts centre', events_venue: 'Event venue',
  airport: 'Airport', shopping_mall: 'Shopping mall',
};
export const label = (c: string) => CAT_LABEL[c] || c;

export function ProspectBrowser({ venues, staff }: { venues: Venue[]; staff: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = venues.find((v) => v.id === openId) || null;
  return (
    <>
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-black/10">
              <th className="p-2.5 font-medium">Venue</th>
              <th className="p-2.5 font-medium">Type</th>
              <th className="p-2.5 font-medium">State</th>
              <th className="p-2.5 font-medium">Stage</th>
              <th className="p-2.5 font-medium">Contacted</th>
              <th className="p-2.5 font-medium">Email</th>
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id} onClick={() => setOpenId(v.id)} className="border-b border-black/5 hover:bg-sand/40 cursor-pointer">
                <td className="p-2.5 font-medium">{v.name}{v.tier === 'premium' && <span className="ml-1 text-[10px] text-honey">💎</span>}{v.signed_on && <span className="ml-1 text-[10px] text-emerald-700">✅ signed</span>}</td>
                <td className="p-2.5 text-muted">{label(v.category)}</td>
                <td className="p-2.5 text-muted">{v.state}</td>
                <td className="p-2.5"><span className="text-[11px] px-1.5 py-0.5 rounded bg-sand capitalize">{v.stage}</span></td>
                <td className="p-2.5">{v.contacted ? '✅' : <span className="text-muted">—</span>}</td>
                <td className="p-2.5 text-muted truncate max-w-[180px]">{v.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <VenueModal venue={open} staff={staff} onClose={() => setOpenId(null)} />}
    </>
  );
}

export function VenueModal({ venue, staff, onClose }: { venue: Venue; staff: string[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState<Venue>(venue);
  const set = (p: Partial<Venue>) => setF({ ...f, ...p });

  const save = () => start(async () => {
    const patch: VenuePatch = {
      stage: f.stage, contacted: f.contacted, assigned_to: f.assigned_to || null, notes: f.notes || null,
      registered_for_launch: f.registered_for_launch, signed_on: f.signed_on, device: f.signed_on ? (f.device || null) : null,
    };
    const r = await updateVenue(venue.id, patch);
    if (r.ok) { router.refresh(); onClose(); } else { alert('Save failed: ' + r.error); }
  });

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="card bg-cream w-full max-w-lg p-5 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold">{venue.name} {venue.tier === 'premium' && <span className="text-xs text-honey">💎 Premium</span>}</h2>
            <p className="text-sm text-muted">{label(venue.category)} · {venue.city ? venue.city + ', ' : ''}{venue.state}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">×</button>
        </div>

        <div className="text-sm space-y-1 mb-4 text-muted">
          {venue.address && <div>📍 {venue.address}</div>}
          {venue.phone && <div>📞 <a href={`tel:${venue.phone}`} className="hover:text-honey">{venue.phone}</a></div>}
          {venue.email && <div>✉️ <a href={`mailto:${venue.email}`} className="hover:text-honey">{venue.email}</a></div>}
          {venue.website && <div>🔗 <a href={venue.website} target="_blank" rel="noreferrer" className="hover:text-honey">{venue.website}</a></div>}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs text-muted">Stage
            <select value={f.stage} onChange={(e) => set({ stage: e.target.value })} className="mt-1 w-full border border-beige rounded px-2 py-1.5 text-sm bg-white capitalize">
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">Assigned to
            <select value={f.assigned_to || ''} onChange={(e) => set({ assigned_to: e.target.value })} className="mt-1 w-full border border-beige rounded px-2 py-1.5 text-sm bg-white">
              <option value="">— unassigned —</option>
              {staff.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={() => set({ contacted: !f.contacted })} className={`text-xs px-3 py-1.5 rounded ${f.contacted ? 'bg-ink text-cream' : 'card'}`}>{f.contacted ? '✅ Contacted' : 'Mark contacted'}</button>
          <button onClick={() => set({ registered_for_launch: !f.registered_for_launch })} className={`text-xs px-3 py-1.5 rounded ${f.registered_for_launch ? 'bg-ink text-cream' : 'card'}`}>{f.registered_for_launch ? '✅ Registered for launch' : 'Register for launch'}</button>
          <button onClick={() => set({ signed_on: !f.signed_on })} className={`text-xs px-3 py-1.5 rounded ${f.signed_on ? 'bg-emerald-700 text-cream' : 'card'}`}>{f.signed_on ? '✅ Signed on' : 'Mark signed on'}</button>
        </div>

        {f.signed_on && (
          <label className="text-xs text-muted block mb-3">Device / station
            <select value={f.device || ''} onChange={(e) => set({ device: e.target.value })} className="mt-1 w-full border border-beige rounded px-2 py-1.5 text-sm bg-white">
              <option value="">— choose device —</option>
              {DEVICES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}

        <label className="text-xs text-muted block mb-4">Notes
          <textarea value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })} rows={4} className="mt-1 w-full border border-beige rounded px-2 py-1.5 text-sm bg-white" placeholder="Call outcome, contact name, next step…" />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={save} disabled={pending} className="btn-primary text-sm">{pending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
