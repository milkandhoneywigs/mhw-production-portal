import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Agent status reporter. The local agents on the Mac Studio (SEO/GEO, Marketing,
// Claudia, the Agent Runner) POST here after each run so the Command Centre
// shows live agent activity. Guarded by x-mhw-secret. Insert-only + a touch of
// agents.last_update_at/status — nothing else can be written through here.
// -----------------------------------------------------------------------------

const UPDATE_TYPES = new Set(['info', 'warning', 'success', 'error', 'recommendation']);
const MODULES = new Set(['production', 'customer_service', 'seo', 'marketing', 'inventory', 'finance', 'partnerships', 'command_centre', 'other']);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-mhw-secret');
  if (!process.env.SHOPIFY_SYNC_SECRET || secret !== process.env.SHOPIFY_SYNC_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const slug = String(body?.slug ?? '').trim();
  const title = String(body?.title ?? '').trim();
  if (!slug || !title) return NextResponse.json({ error: 'slug and title required' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: agent } = await supabase.from('agents').select('id').eq('slug', slug).maybeSingle();
  if (!agent) return NextResponse.json({ error: `unknown agent slug: ${slug}` }, { status: 404 });

  const updateType = UPDATE_TYPES.has(String(body?.update_type)) ? String(body.update_type) : 'info';
  const sourceModule = MODULES.has(String(body?.source_module)) ? String(body.source_module) : 'other';

  const { error } = await supabase.from('agent_updates').insert({
    agent_id: agent.id,
    title: title.slice(0, 200),
    summary: body?.summary ? String(body.summary).slice(0, 2000) : null,
    update_type: updateType,
    source_module: sourceModule,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Touch the agent: it just reported in, so it's alive.
  await supabase.from('agents').update({
    last_update_at: new Date().toISOString(),
    ...(body?.next_action ? { next_action: String(body.next_action).slice(0, 300) } : {}),
    ...(body?.status && ['active', 'paused', 'planned', 'error'].includes(String(body.status)) ? { status: String(body.status) } : {}),
  }).eq('id', agent.id);

  return NextResponse.json({ ok: true, agent: slug });
}
