-- =============================================================================
-- Claudia module (Customer Service agent workspace in the Command Centre).
-- Portal-side structure only: no Gorgias connection, no sending, no auto-send.
-- Text + CHECK constraints (not enums) so categories can evolve without ALTER
-- TYPE migrations. RLS: admin-only, same posture as the rest of the centre.
-- =============================================================================

create table if not exists claudia_topic_confidence (
  id uuid primary key default gen_random_uuid(),
  topic_name text not null,
  topic_category text,
  confidence_level text not null default 'low' check (confidence_level in ('low','medium','high')),
  confidence_score numeric,
  action_mode text not null default 'approval_required'
    check (action_mode in ('read_only','draft_only','approval_required','auto_allowed_later')),
  current_rule text,
  examples text,
  active boolean not null default true,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists claudia_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  period_label text not null,   -- today | this_week | this_month
  tickets_reviewed integer default 0,
  drafts_created integer default 0,
  drafts_approved integer default 0,
  drafts_edited integer default 0,
  drafts_rejected integer default 0,
  approval_rate numeric,
  edit_rate numeric,
  rejection_rate numeric,
  average_confidence_score numeric,
  average_response_time_minutes numeric,
  customer_rating_average numeric,
  escalation_rate numeric,
  estimated_time_saved_minutes numeric,
  created_at timestamptz not null default now()
);

create table if not exists claudia_staff_review_metrics (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid references profiles(id) on delete set null,
  staff_name text not null,
  period_start date not null,
  period_end date not null,
  drafts_reviewed integer default 0,
  approved_count integer default 0,
  edited_count integer default 0,
  rejected_count integer default 0,
  average_review_time_minutes numeric,
  common_edit_reason text,
  coaching_note text,
  created_at timestamptz not null default now()
);

create table if not exists claudia_optimisation_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  opportunity_type text not null default 'template'
    check (opportunity_type in ('template','knowledge_gap','workflow','tone','escalation_rule','integration','training')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'suggested'
    check (status in ('suggested','approved','in_progress','completed','dismissed')),
  estimated_impact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists claudia_tone_settings (
  id uuid primary key default gen_random_uuid(),
  warmth text not null default 'high' check (warmth in ('low','medium','high')),
  empathy text not null default 'high' check (empathy in ('low','medium','high')),
  formality text not null default 'medium' check (formality in ('low','medium','high')),
  directness text not null default 'medium' check (directness in ('low','medium','high')),
  policy_firmness text not null default 'medium' check (policy_firmness in ('low','medium','high')),
  escalation_sensitivity text not null default 'high' check (escalation_sensitivity in ('low','medium','high')),
  sales_tone text not null default 'low' check (sales_tone in ('low','medium','high')),
  hard_rules jsonb not null default '[]'::jsonb,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists claudia_knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  gap_title text not null,
  description text,
  source_ticket_count integer default 0,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  suggested_training_content text,
  status text not null default 'open'
    check (status in ('open','training_needed','in_progress','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists claudia_ticket_insights (
  id uuid primary key default gen_random_uuid(),
  ticket_source text not null default 'demo' check (ticket_source in ('gorgias','manual','demo','other')),
  ticket_id text,
  customer_name text,
  topic text not null,
  sentiment text not null default 'unknown'
    check (sentiment in ('positive','neutral','frustrated','angry','distressed','unknown')),
  risk_level text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  claudia_confidence numeric,
  recommended_action text not null default 'draft'
    check (recommended_action in ('draft','approval_required','escalate','no_action')),
  summary text,
  created_at timestamptz not null default now()
);

-- updated_at triggers (cc_touch_updated_at() from migration 0003)
do $$
declare t text;
begin
  foreach t in array array['claudia_topic_confidence','claudia_optimisation_opportunities',
                           'claudia_tone_settings','claudia_knowledge_gaps']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function cc_touch_updated_at()', t);
  end loop;
end $$;

-- RLS: owner/admin only (service role bypasses for the local agents/runner).
do $$
declare t text;
begin
  foreach t in array array['claudia_topic_confidence','claudia_performance_metrics',
                           'claudia_staff_review_metrics','claudia_optimisation_opportunities',
                           'claudia_tone_settings','claudia_knowledge_gaps','claudia_ticket_insights']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %1$s_admin_all on %1$s', t);
    execute format('create policy %1$s_admin_all on %1$s for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
