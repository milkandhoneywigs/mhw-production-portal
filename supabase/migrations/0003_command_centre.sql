-- =============================================================================
-- Beyond Reason Command Centre (owner/admin-only Master Portal)
-- Portal-side structure only: command queue + agents + financials + approvals +
-- risks + tasks + plans + workers. No execution here — the Mac Studio runner
-- (built later) polls agent_commands and writes results back. RLS: admin only.
-- =============================================================================

-- ---- ENUMS ------------------------------------------------------------------
do $$ begin
  create type cc_command_type    as enum ('analyse','report','draft','workflow','approval_request','terminal_task','update_plan','other');
  create type cc_priority        as enum ('low','medium','high','urgent');
  create type cc_command_status  as enum ('queued','claimed','running','completed','failed','needs_approval','cancelled');
  create type cc_exec_target     as enum ('mac_studio','vercel','manual','external_api');
  create type cc_exec_mode        as enum ('local_agent','claude_code','script','api','manual');
  create type cc_agent_status    as enum ('active','paused','planned','error');
  create type cc_agent_risk      as enum ('low','medium','high');
  create type cc_update_type     as enum ('info','warning','success','error','recommendation');
  create type cc_sender_type     as enum ('owner','agent','system','worker');
  create type cc_result_type     as enum ('summary','report','task','approval_request','risk_alert','draft','file','error','terminal_output');
  create type cc_worker_type     as enum ('mac_studio','server','manual');
  create type cc_worker_status   as enum ('online','offline','busy','error');
  create type cc_log_level       as enum ('info','warning','error','debug');
  create type cc_permission_level as enum ('read','draft','approval_required','auto_action');
  create type cc_tool_conn_type  as enum ('api','webhook','browser','manual','not_connected');
  create type cc_tool_status     as enum ('connected','planned','error','disabled');
  create type cc_source_module   as enum ('production','customer_service','seo','marketing','inventory','finance','partnerships','command_centre','other');
  create type cc_approval_type   as enum ('supplier_payment','balance_payment','customer_message','refund','seo_change','ad_budget','stock_order','partnership','agent_action','other');
  create type cc_approval_status as enum ('pending','approved','rejected','snoozed','completed');
  create type cc_risk_level      as enum ('low','medium','high','critical');
  create type cc_risk_status     as enum ('open','acknowledged','resolved','dismissed');
  create type cc_task_status     as enum ('todo','in_progress','blocked','done','cancelled');
  create type cc_plan_status     as enum ('draft','active','paused','completed');
  create type cc_metric_category as enum ('revenue','production','supplier_liability','cashflow','marketing','customer_service','inventory','other');
  create type cc_metric_period   as enum ('today','week','month','quarter','year','custom');
  create type cc_metric_source   as enum ('manual','shopify','xero','paypal','bank','portal','other');
exception when duplicate_object then null; end $$;

-- Generic updated_at trigger for command-centre tables.
create or replace function cc_touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ---- TABLES -----------------------------------------------------------------
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_area text,
  description text,
  status cc_agent_status not null default 'planned',
  risk_level cc_agent_risk not null default 'low',
  module_link text,
  last_update_at timestamptz,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_updates (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  title text not null,
  summary text,
  update_type cc_update_type not null default 'info',
  source_module cc_source_module,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists agent_commands (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  title text,
  prompt text not null,
  command_type cc_command_type not null default 'analyse',
  priority cc_priority not null default 'medium',
  status cc_command_status not null default 'queued',
  execution_target cc_exec_target not null default 'mac_studio',
  execution_mode cc_exec_mode not null default 'local_agent',
  claimed_by_worker uuid,
  claimed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  result_summary text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_command_messages (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references agent_commands(id) on delete cascade,
  sender_type cc_sender_type not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists agent_command_results (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references agent_commands(id) on delete cascade,
  result_type cc_result_type not null default 'summary',
  title text,
  content text,
  file_url text,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists agent_workers (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  machine_name text,
  worker_type cc_worker_type not null default 'mac_studio',
  status cc_worker_status not null default 'offline',
  last_seen_at timestamptz,
  current_command_id uuid references agent_commands(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_run_logs (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references agent_commands(id) on delete cascade,
  worker_id uuid references agent_workers(id) on delete set null,
  log_level cc_log_level not null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  capability_name text not null,
  description text,
  execution_mode cc_exec_mode not null default 'local_agent',
  permission_level cc_permission_level not null default 'read',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists agent_tool_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  tool_name text not null,
  connection_type cc_tool_conn_type not null default 'not_connected',
  status cc_tool_status not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists owner_approvals (
  id uuid primary key default gen_random_uuid(),
  source_module cc_source_module not null default 'command_centre',
  agent_id uuid references agents(id) on delete set null,
  command_id uuid references agent_commands(id) on delete set null,
  title text not null,
  description text,
  approval_type cc_approval_type not null default 'other',
  priority cc_priority not null default 'medium',
  financial_impact numeric,
  currency text,
  status cc_approval_status not null default 'pending',
  related_entity_type text,
  related_entity_id uuid,
  requested_by uuid references profiles(id) on delete set null,
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists owner_risks (
  id uuid primary key default gen_random_uuid(),
  source_module cc_source_module not null default 'command_centre',
  agent_id uuid references agents(id) on delete set null,
  command_id uuid references agent_commands(id) on delete set null,
  title text not null,
  description text,
  risk_level cc_risk_level not null default 'medium',
  financial_impact numeric,
  currency text,
  status cc_risk_status not null default 'open',
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists business_tasks (
  id uuid primary key default gen_random_uuid(),
  source_module cc_source_module not null default 'command_centre',
  agent_id uuid references agents(id) on delete set null,
  command_id uuid references agent_commands(id) on delete set null,
  title text not null,
  description text,
  status cc_task_status not null default 'todo',
  priority cc_priority not null default 'medium',
  assigned_to uuid references profiles(id) on delete set null,
  due_at timestamptz,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_plans (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  title text not null,
  objective text,
  current_focus text,
  next_actions jsonb not null default '[]'::jsonb,
  status cc_plan_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_name text not null,
  metric_category cc_metric_category not null default 'other',
  metric_value numeric not null default 0,
  currency text,
  period cc_metric_period not null default 'today',
  source cc_metric_source not null default 'manual',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  today_revenue numeric default 0,
  week_revenue numeric default 0,
  month_revenue numeric default 0,
  online_revenue numeric default 0,
  instore_revenue numeric default 0,
  outlet_revenue numeric default 0,
  refunds numeric default 0,
  net_sales numeric default 0,
  supplier_payments_due numeric default 0,
  balance_payments_due numeric default 0,
  unpaid_supplier_invoices numeric default 0,
  orders_blocked_by_payment integer default 0,
  estimated_production_spend_month numeric default 0,
  paid_supplier_invoices_month numeric default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ---- updated_at triggers ----------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['agents','agent_commands','agent_workers','agent_tool_connections',
                           'owner_approvals','business_tasks','agent_plans']
  loop
    execute format('drop trigger if exists trg_%1$s_updated on %1$s', t);
    execute format('create trigger trg_%1$s_updated before update on %1$s for each row execute function cc_touch_updated_at()', t);
  end loop;
end $$;

-- ---- INDEXES ----------------------------------------------------------------
create index if not exists idx_agent_commands_status on agent_commands(status);
create index if not exists idx_agent_commands_agent on agent_commands(agent_id);
create index if not exists idx_agent_updates_agent on agent_updates(agent_id);
create index if not exists idx_cmd_messages_cmd on agent_command_messages(command_id);
create index if not exists idx_cmd_results_cmd on agent_command_results(command_id);
create index if not exists idx_run_logs_cmd on agent_run_logs(command_id);
create index if not exists idx_owner_approvals_status on owner_approvals(status);
create index if not exists idx_owner_risks_status on owner_risks(status);
create index if not exists idx_business_tasks_status on business_tasks(status);

-- ---- RLS: OWNER/ADMIN ONLY --------------------------------------------------
-- Every command-centre table is admin-only. is_admin() is the SECURITY DEFINER
-- helper from 0001. Staff and suppliers get nothing. The service role (Mac
-- Studio runner, later) bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array['agents','agent_updates','agent_commands','agent_command_messages',
                           'agent_command_results','agent_workers','agent_run_logs','agent_capabilities',
                           'agent_tool_connections','owner_approvals','owner_risks','business_tasks',
                           'agent_plans','business_metrics','financial_snapshots']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %1$s_admin_all on %1$s', t);
    execute format('create policy %1$s_admin_all on %1$s for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
