import { createServiceClient } from './supabase/service';

// Writes an audit-log entry. Uses the service client so the write always
// succeeds regardless of the actor's RLS, but the actor_id is recorded so the
// trail is accurate. Call from server actions for every important action.
export async function logAudit(params: {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const svc = createServiceClient();
    await svc.from('audit_logs').insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (e) {
    // Never let audit logging break the primary action.
    console.error('audit log failed', e);
  }
}
