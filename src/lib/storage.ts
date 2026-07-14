import 'server-only';
import { createServiceClient } from './supabase/service';

export const ORDER_FILES_BUCKET = 'order-files';

// Turn stored file references into browser-openable URLs. Legacy rows hold full
// http(s) URLs (pasted links) — pass those through. New rows hold private
// storage paths (orders/<order_id>/<file>) — sign them for 1 hour.
// SECURITY: only call with paths from rows the caller could already read via RLS.
export async function signFileUrls(refs: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const paths = refs.filter((r) => r && !r.startsWith('http'));
  for (const r of refs.filter((r) => r?.startsWith('http'))) out[r] = r;
  if (paths.length === 0) return out;

  const service = createServiceClient();
  const { data } = await service.storage.from(ORDER_FILES_BUCKET).createSignedUrls(paths, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}
