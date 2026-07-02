-- =============================================================================
-- SEO Agent module (SEO + GEO growth workspace in the Command Centre).
-- Portal-side structure only: no Semrush/Shopify/GSC connections here, no
-- publishing, no live-store edits — suggest-only with owner approval gates.
-- Text + CHECK constraints (not enums) so categories can evolve. RLS admin-only.
-- =============================================================================

create table if not exists seo_keyword_opportunities (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  search_volume integer,
  keyword_difficulty numeric,
  intent text not null default 'commercial'
    check (intent in ('informational','commercial','transactional','navigational','mixed')),
  current_position numeric,
  previous_position numeric,
  ranking_url text,
  target_url text,
  opportunity_type text not null default 'other'
    check (opportunity_type in ('product','collection','blog','faq','schema','internal_link','redirect','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'new'
    check (status in ('new','reviewing','approved','in_progress','completed','dismissed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seo_geo_opportunities (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  target_page text,
  current_visibility text not null default 'none'
    check (current_visibility in ('none','low','medium','high')),
  recommended_answer_content text,
  evidence_needed text,
  schema_recommendation text,
  internal_link_recommendation text,
  content_gap text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  approval_status text not null default 'draft'
    check (approval_status in ('draft','needs_approval','approved','implemented','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seo_product_page_opportunities (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  shopify_url text,
  target_keyword text,
  current_title text,
  suggested_title text,
  current_meta_description text,
  suggested_meta_description text,
  current_product_description_status text not null default 'okay'
    check (current_product_description_status in ('missing','thin','okay','strong')),
  suggested_description text,
  internal_link_suggestions text,
  schema_recommendations text,
  status text not null default 'draft'
    check (status in ('draft','needs_approval','approved','implemented','dismissed')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seo_collection_opportunities (
  id uuid primary key default gen_random_uuid(),
  collection_name text not null,
  collection_url text,
  target_keywords text[],
  current_description_status text not null default 'thin'
    check (current_description_status in ('missing','thin','okay','strong')),
  suggested_collection_description text,
  suggested_meta_title text,
  suggested_meta_description text,
  faq_suggestions text,
  internal_link_suggestions text,
  schema_recommendations text,
  approval_status text not null default 'draft'
    check (approval_status in ('draft','needs_approval','approved','implemented','dismissed')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seo_content_plan (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  target_keyword text,
  intent text not null default 'informational'
    check (intent in ('informational','commercial','transactional','navigational','mixed')),
  funnel_stage text not null default 'awareness'
    check (funnel_stage in ('awareness','consideration','conversion','retention')),
  suggested_title text not null,
  outline text,
  status text not null default 'idea'
    check (status in ('idea','draft','needs_approval','approved','published','dismissed')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  related_products text,
  related_collections text,
  internal_links_to_include text,
  geo_questions_answered text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seo_schema_opportunities (
  id uuid primary key default gen_random_uuid(),
  page_url text not null,
  page_type text not null default 'other'
    check (page_type in ('product','collection','blog','faq','organisation','local_business','other')),
  schema_type text not null default 'other'
    check (schema_type in ('product','faq','breadcrumb','article','organisation','local_business','review','howto','other')),
  current_status text not null default 'missing'
    check (current_status in ('missing','present','error','warning','strong')),
  issue_description text,
  recommendation text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  approval_status text not null default 'draft'
    check (approval_status in ('draft','needs_approval','approved','implemented','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seo_optimisation_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  opportunity_type text not null default 'technical'
    check (opportunity_type in ('keyword_gap','content_gap','meta','schema','redirect','internal_link','geo','technical','product','collection','blog')),
  source text not null default 'seo_agent'
    check (source in ('semrush','manual','seo_agent','shopify','search_console','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  estimated_impact text not null default 'medium' check (estimated_impact in ('low','medium','high')),
  effort text not null default 'medium' check (effort in ('low','medium','high')),
  approval_required boolean not null default true,
  status text not null default 'suggested'
    check (status in ('suggested','needs_approval','approved','in_progress','completed','dismissed')),
  related_url text,
  related_keyword text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seo_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  period_label text not null,
  organic_sessions integer,
  organic_revenue numeric,
  ranking_keywords integer,
  top_3_keywords integer,
  top_10_keywords integer,
  keyword_gains integer,
  keyword_losses integer,
  pages_missing_meta integer,
  pages_with_thin_content integer,
  schema_issues integer,
  geo_visibility_score numeric,
  approved_optimisations integer,
  implemented_optimisations integer,
  traffic_opportunity_estimate numeric,
  created_at timestamptz not null default now()
);

create table if not exists seo_agent_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null,
  rule_description text,
  rule_type text not null default 'approval'
    check (rule_type in ('approval','tone','safety','seo_quality','geo','technical')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['seo_keyword_opportunities','seo_geo_opportunities','seo_product_page_opportunities',
                           'seo_collection_opportunities','seo_content_plan','seo_schema_opportunities',
                           'seo_optimisation_opportunities','seo_agent_rules']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function cc_touch_updated_at()', t);
  end loop;
end $$;

-- RLS: owner/admin only
do $$
declare t text;
begin
  foreach t in array array['seo_keyword_opportunities','seo_geo_opportunities','seo_product_page_opportunities',
                           'seo_collection_opportunities','seo_content_plan','seo_schema_opportunities',
                           'seo_optimisation_opportunities','seo_performance_metrics','seo_agent_rules']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %1$s_admin_all on %1$s', t);
    execute format('create policy %1$s_admin_all on %1$s for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
