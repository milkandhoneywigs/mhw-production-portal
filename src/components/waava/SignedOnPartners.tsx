'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateVenue } from '@/app/(command)/command-centre/waava/actions';
import { DEVICES, label, type Venue } from './ProspectBrowser';

export function SignedOnPartners({ venues }: { venues: Venue[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const setDevice = (id: string, device: string) => start(async () => {
    const r = await updateVenue(id, { signed_on: true, device: device || null });
    if (r.ok) router.refresh(); else alert('Save failed: ' + r.error);
  });

  if (!venues.length) {
    return (
      <div className="card p-6 text-center text-sm text-muted">
        No signed-on partners yet. Mark a venue “Signed on” from its detail panel and it appears here
        with a device to assign.
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-black/10">
            <th className="p-2.5 font-medium">Partner venue</th>
            <th className="p-2.5 font-medium">Type</th>
            <th className="p-2.5 font-medium">State</th>
            <th className="p-2.5 font-medium">Phone</th>
            <th className="p-2.5 font-medium">Email</th>
            <th className="p-2.5 font-medium">Assigned</th>
            <th className="p-2.5 font-medium">Device</th>
          </tr>
        </thead>
        <tbody>
          {venues.map((v) => (
            <tr key={v.id} className="border-b border-black/5">
              <td className="p-2.5 font-medium">{v.website ? <a href={v.website} target="_blank" rel="noreferrer" className="hover:text-honey">{v.name}</a> : v.name}{v.tier === 'premium' && <span className="ml-1 text-[10px] text-honey">💎</span>}</td>
              <td className="p-2.5 text-muted">{label(v.category)}</td>
              <td className="p-2.5 text-muted">{v.state}</td>
              <td className="p-2.5 tabular-nums">{v.phone || '—'}</td>
              <td className="p-2.5 text-muted truncate max-w-[180px]">{v.email || '—'}</td>
              <td className="p-2.5 text-muted">{v.assigned_to || '—'}</td>
              <td className="p-2.5">
                <select value={v.device || ''} disabled={pending} onChange={(e) => setDevice(v.id, e.target.value)}
                  className={`border rounded px-2 py-1 text-sm bg-white ${v.device ? 'border-emerald-600 text-emerald-800' : 'border-beige text-muted'}`}>
                  <option value="">— choose —</option>
                  {DEVICES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
