import { createClient as createAdminClient } from '@supabase/supabase-js';

// SERVER-ONLY. Uses the service-role key, which BYPASSES RLS.
// Use ONLY inside trusted server actions after an explicit admin role check
// (e.g. creating users in Settings, writing audit logs). Never import into a
// Client Component.
export function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
