-- =============================================================================
-- Marketing Agent module (Marketing / CRO / Growth workspace in the Command
-- Centre). Suggest-only: never changes budgets, launches/pauses ads, sends
-- email, edits Shopify or discounts — owner approval gates everything that
-- spends or faces customers. PREMIUM and OUTLET tagged, never blended.
-- Text + CHECK constraints; RLS admin-only; decision_note on approvables.
-- =============================================================================

create table if not exists mkt_paid_campaigns (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('google','meta','other')),
  campaign_name text not null,
  brand text not null default 'premium' check (brand in ('premium','outlet')),
  period_label text not null default 'last_30_days',
  spend numeric,
  clicks integer,
  conversions numeric,
  revenue numeric,
  roas numeric,
  verdict text not null default 'monitoring'
    check (verdict in ('working','scale','monitoring','underperforming','wasting','new_launch')),
  launched_on date,
  notes text,
  source text default 'supermetrics_drop',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_blended_performance (
  id uuid primary key default gen_random_uuid(),
  period_label text not null,
  period_start date,
  period_end date,
  total_ad_spend numeric,
  attributed_revenue numeric,
  blended_revenue numeric,
  mer numeric,                -- blended_revenue / total_ad_spend
  google_spend numeric, google_roas numeric,
  meta_spend numeric, meta_roas numeric,
  email_revenue numeric,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists mkt_cro_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  page_or_funnel text,
  issue text,
  evidence text,              -- sourced numbers only
  hypothesis text,
  suggested_fix text,
  metric_to_move text,
  brand text not null default 'premium' check (brand in ('premium','outlet')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  approval_status text not null default 'draft'
    check (approval_status in ('draft','needs_approval','approved','implemented','dismissed')),
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_funnel_snapshots (
  id uuid primary key default gen_random_uuid(),
  period_label text not null,
  segment text not null,       -- e.g. AU / US / NZ / UK / mobile / desktop
  sessions integer,
  orders integer,
  revenue numeric,
  conversion_rate numeric,     -- %
  add_to_cart_rate numeric,
  checkout_rate numeric,
  source text default 'ga4',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists mkt_creative_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'meta' check (channel in ('meta','google','email','organic','other')),
  angle text,
  format text,
  brand text not null default 'premium' check (brand in ('premium','outlet')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'requested'
    check (status in ('requested','needs_approval','approved','in_production','ready','live','dismissed')),
  decision_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_email_opportunities (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('klaviyo','omnisend')),
  brand text not null check (brand in ('premium','outlet')),
  title text not null,
  description text,
  opportunity_type text not null default 'flow'
    check (opportunity_type in ('flow','campaign','segment','template','automation','other')),
  expected_impact text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'suggested'
    check (status in ('suggested','needs_approval','approved','implemented','dismissed')),
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_campaign_calendar (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channels text,
  brand text not null default 'premium' check (brand in ('premium','outlet')),
  starts_on date,
  ends_on date,
  description text,
  proposed_budget numeric,
  status text not null default 'planned'
    check (status in ('planned','needs_approval','approved','live','completed','cancelled')),
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_growth_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hypothesis text,
  metric text,
  expected_impact text check (expected_impact in ('low','medium','high')),
  effort text check (effort in ('low','medium','high')),
  brand text not null default 'premium' check (brand in ('premium','outlet')),
  status text not null default 'idea'
    check (status in ('idea','planned','needs_approval','approved','running','completed','dismissed')),
  result text,
  learnings text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_budget_recommendations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  move_from text,
  move_to text,
  amount numeric,
  rationale text,             -- sourced evidence
  brand text not null default 'premium' check (brand in ('premium','outlet')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'suggested'
    check (status in ('suggested','needs_approval','approved','implemented','dismissed')),
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mkt_growth_ledger (
  id uuid primary key default gen_random_uuid(),
  ledger_ref text not null unique,   -- L-001 etc (mirrors knowledge/marketing/GROWTH-LEDGER.md)
  title text not null,
  brand text not null default 'premium' check (brand in ('premium','outlet')),
  source_arm text not null default 'marketing' check (source_arm in ('marketing','seo-geo')),
  evidence text,
  cross_arm_implication text,
  confidence text check (confidence in ('low','medium','high')),
  status text not null default 'active' check (status in ('active','superseded')),
  created_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['mkt_paid_campaigns','mkt_cro_opportunities','mkt_creative_requests',
                           'mkt_email_opportunities','mkt_campaign_calendar','mkt_growth_experiments',
                           'mkt_budget_recommendations']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function cc_touch_updated_at()', t);
  end loop;
end $$;

-- RLS admin-only
do $$
declare t text;
begin
  foreach t in array array['mkt_paid_campaigns','mkt_blended_performance','mkt_cro_opportunities',
                           'mkt_funnel_snapshots','mkt_creative_requests','mkt_email_opportunities',
                           'mkt_campaign_calendar','mkt_growth_experiments','mkt_budget_recommendations',
                           'mkt_growth_ledger']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %1$s_admin_all on %1$s', t);
    execute format('create policy %1$s_admin_all on %1$s for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
