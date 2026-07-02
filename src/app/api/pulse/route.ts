import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Business Pulse intake. The sentinels (local 10-min site/checkout/DB monitor +
// hourly cloud conversion monitor) POST alerts here. Each alert becomes an
// owner risk (PULSE-prefixed, deduped while open) and can ENGAGE an agent by
// queueing a diagnosis command that the Mac Studio runs immediately.
// Guard: x-mhw-secret. Resolutions clear the open risk when the check recovers.
// -----------------------------------------------------------------------------

const LEVELS = new Set(['low', 'medium', 'high', 'critical']);
const MODULES = new Set(['production', 'customer_service', 'seo', 'marketing', 'inventory', 'finance', 'partnerships', 'command_centre', 'other']);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-mhw-secret');
  if (!process.env.SHOPIFY_SYNC_SECRET || secret !== process.env.SHOPIFY_SYNC_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const supabase = createServiceClient();
  const results: any[] = [];

  // Recoveries: {resolve: "<alert key>"} closes the matching open PULSE risk.
  for (const key of Array.isArray(body?.resolve) ? body.resolve : []) {
    const title = `PULSE: ${String(key)}`.slice(0, 190);
    const { data } = await supabase.from('owner_risks').update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('title', title).in('status', ['open', 'acknowledged']).select('id');
    if (data?.length) results.push({ resolved: key, count: data.length });
  }

  for (const a of Array.isArray(body?.alerts) ? body.alerts.slice(0, 10) : []) {
    const key = String(a?.key ?? a?.title ?? '').trim();
    if (!key) continue;
    const title = `PULSE: ${key}`.slice(0, 190);
    const level = LEVELS.has(String(a?.severity)) ? String(a.severity) : 'high';
    const module = MODULES.has(String(a?.module)) ? String(a.module) : 'command_centre';

    // Dedupe: don't re-file while the same alert is still open.
    const { data: existing } = await supabase.from('owner_risks').select('id').eq('title', title).in('status', ['open', 'acknowledged']).maybeSingle();
    if (existing) { results.push({ alert: key, skipped: 'already open' }); continue; }

    await supabase.from('owner_risks').insert({
      source_module: module, title,
      description: String(a?.detail ?? '').slice(0, 1500),
      risk_level: level, status: 'open',
    });

    // Engage an agent: queue an immediate diagnosis command.
    let engaged: string | null = null;
    if (a?.engage_agent_slug) {
      const { data: agent } = await supabase.from('agents').select('id').eq('slug', String(a.engage_agent_slug)).maybeSingle();
      if (agent) {
        await supabase.from('agent_commands').insert({
          agent_id: agent.id,
          title: `PULSE diagnosis: ${key}`.slice(0, 190),
          prompt: `BUSINESS PULSE ALERT (${level.toUpperCase()}): ${key}\n\nDetail: ${a?.detail ?? ''}\n\nDiagnose this immediately using live data (business brain + portal DB + any drops). Report per the AGENT-REPORTING-STANDARD: what is actually happening (sourced), root cause if determinable, what you recommend, and what needs the owner. Do NOT take live actions — diagnosis and recommendation only.`,
          command_type: 'analyse', priority: level === 'critical' ? 'urgent' : 'high',
          status: 'queued', execution_target: 'mac_studio', execution_mode: 'local_agent',
        });
        engaged = String(a.engage_agent_slug);
      }
    }
    results.push({ alert: key, filed: true, engaged });
  }

  return NextResponse.json({ ok: true, results });
}
