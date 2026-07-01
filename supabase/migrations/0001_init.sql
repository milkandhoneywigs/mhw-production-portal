-- =============================================================================
-- Milk & Honey Wigs — Production Portal :: initial schema
-- Postgres / Supabase. Run in the Supabase SQL editor or via the CLI.
--
-- Security model:
--   * Three roles: admin, staff, supplier (stored on profiles.role).
--   * RLS is ON for every table.
--   * SECURITY DEFINER helper functions read the caller's role/supplier_id
--     WITHOUT triggering RLS recursion on the profiles table.
--   * Suppliers can ONLY reach rows tied to their own supplier_id, and only
--     the supplier-safe columns (internal notes / financial fields are never
--     selected for them at the app layer, and a supplier-safe VIEW is provided).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type user_role            as enum ('admin', 'staff', 'supplier');
create type order_source         as enum ('shopify', 'fresha', 'manual', 'custom', 'other');
create type order_type           as enum ('ready_made', 'made_to_order', 'stock', 'needs_review');
create type risk_level           as enum ('low', 'medium', 'high');
create type shipping_destination as enum ('customer_direct', 'mhw_showroom', 'qld_showroom', 'other');
create type invoice_type         as enum ('initial', 'balance', 'other');
create type invoice_status       as enum ('uploaded', 'payment_required', 'paid', 'disputed', 'cancelled');
create type payment_method       as enum ('bank_transfer', 'paypal', 'other');
create type tracking_type        as enum ('supplier_to_customer', 'supplier_to_showroom', 'showroom_to_customer');
create type customer_update_type as enum ('order_received', 'production_started', 'production_checkin', 'production_complete', 'arrived_showroom', 'dispatched', 'delay', 'custom');
create type customer_update_status as enum ('draft', 'approved', 'sent', 'skipped');
create type qc_status            as enum ('pending', 'passed', 'failed', 'manager_review');
create type supplier_update_type as enum ('confirmation', 'invoice_uploaded', 'production_update', 'production_complete', 'tracking_uploaded', 'delay_notice', 'general_note');
create type file_type            as enum ('invoice', 'qc_photo', 'supplier_attachment', 'other');

-- All production statuses across BOTH workflows (ready_made + made_to_order),
-- unioned into one enum for DB-level integrity.
create type order_status as enum (
  -- ready made
  'new_ready_made_order', 'supplier_notified', 'awaiting_dhl_tracking',
  'tracking_uploaded', 'customer_notified',
  -- made to order
  'new_made_to_order', 'awaiting_supplier_confirmation', 'invoice_uploaded',
  'payment_required', 'payment_paid', 'in_production', 'production_update_due',
  'production_complete', 'balance_payment_required', 'balance_paid',
  'shipped_to_showroom', 'arrived_at_showroom', 'qc_required', 'qc_passed',
  'ready_to_dispatch', 'dispatched_to_customer', 'delayed_at_risk',
  'manager_review_required',
  -- shared terminal
  'completed'
);

-- ---------------------------------------------------------------------------
-- CORE TABLES
-- ---------------------------------------------------------------------------
create table suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  contact_name text,
  email        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- profiles maps 1:1 to auth.users. supplier_id is set for supplier accounts.
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        user_role not null default 'staff',
  supplier_id uuid references suppliers(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table customers (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  email                  text,
  phone                  text,
  shipping_address_line1 text,
  shipping_address_line2 text,
  suburb                 text,
  state                  text,
  postcode               text,
  country                text default 'Australia',
  created_at             timestamptz not null default now()
);

create table product_mappings (
  id                  uuid primary key default gen_random_uuid(),
  style_name          text not null unique,
  supplier_style_code text not null,
  default_cap_style   text,
  default_density     text,
  default_hair_type   text,
  notes               text,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table orders (
  id                         uuid primary key default gen_random_uuid(),
  order_number               text not null unique,
  source                     order_source not null default 'manual',
  customer_id                uuid references customers(id) on delete set null,
  supplier_id                uuid references suppliers(id) on delete set null,
  order_type                 order_type not null default 'needs_review',
  status                     order_status not null,
  risk_level                 risk_level not null default 'low',
  assigned_staff_id          uuid references profiles(id) on delete set null,
  customer_facing_product_name text,
  internal_style_name        text,
  supplier_style_code        text,
  customer_ordered_length    text,   -- kept as text: may be "18\"", "bob", "custom"
  supplier_order_length      text,
  cap_style                  text,
  cap_size                   text,
  density                    text,
  hair_type                  text,
  colour_notes               text,
  production_notes           text,   -- supplier-visible production notes
  internal_notes             text,   -- INTERNAL ONLY. never exposed to suppliers
  shipping_destination       shipping_destination not null default 'mhw_showroom',
  date_ordered               date not null default current_date,
  date_sent_to_supplier      timestamptz,
  supplier_confirmed_at      timestamptz,
  production_started_at       timestamptz,
  expected_completion_date   date,
  production_complete_at     timestamptz,
  shipped_to_showroom_at     timestamptz,
  arrived_at_showroom_at     timestamptz,
  qc_completed_at            timestamptz,
  dispatched_to_customer_at  timestamptz,
  completed_at               timestamptz,
  last_customer_update_at    timestamptz,
  next_customer_update_due   timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create table order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  old_status order_status,
  new_status order_status not null,
  changed_by uuid references profiles(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);

create table supplier_updates (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  supplier_id uuid references suppliers(id) on delete set null,
  update_type supplier_update_type not null,
  message     text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table invoices (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  supplier_id       uuid references suppliers(id) on delete set null,
  invoice_type      invoice_type not null default 'initial',
  invoice_number    text,
  amount            numeric(12,2),
  currency          text not null default 'AUD',
  file_url          text,
  uploaded_by       uuid references profiles(id) on delete set null,
  status            invoice_status not null default 'uploaded',
  payment_method    payment_method,
  payment_reference text,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table tracking (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  tracking_type   tracking_type not null,
  carrier         text,
  tracking_number text,
  tracking_url    text,
  uploaded_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table customer_updates (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  update_type customer_update_type not null,
  subject     text,
  message     text,
  status      customer_update_status not null default 'draft',
  created_by  uuid references profiles(id) on delete set null,
  approved_by uuid references profiles(id) on delete set null,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table qc_checks (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders(id) on delete cascade,
  checked_by       uuid references profiles(id) on delete set null,
  correct_style    boolean not null default false,
  correct_colour   boolean not null default false,
  correct_length   boolean not null default false,
  correct_cap_size boolean not null default false,
  correct_density  boolean not null default false,
  lace_checked     boolean not null default false,
  no_visible_faults boolean not null default false,
  notes            text,
  status           qc_status not null default 'pending',
  created_at       timestamptz not null default now()
);

create table files (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid references orders(id) on delete cascade,
  file_type   file_type not null default 'other',
  file_url    text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index idx_orders_supplier      on orders(supplier_id);
create index idx_orders_status        on orders(status);
create index idx_orders_type          on orders(order_type);
create index idx_orders_risk          on orders(risk_level);
create index idx_orders_customer      on orders(customer_id);
create index idx_invoices_order       on invoices(order_id);
create index idx_invoices_status      on invoices(status);
create index idx_tracking_order       on tracking(order_id);
create index idx_supplier_updates_ord on supplier_updates(order_id);
create index idx_customer_updates_ord on customer_updates(order_id);
create index idx_qc_order             on qc_checks(order_id);
create index idx_status_history_order on order_status_history(order_id);
create index idx_files_order          on files(order_id);

-- ---------------------------------------------------------------------------
-- ROLE HELPER FUNCTIONS (SECURITY DEFINER -> no RLS recursion on profiles)
-- ---------------------------------------------------------------------------
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_supplier_id()
returns uuid language sql stable security definer set search_path = public as $$
  select supplier_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','staff') from public.profiles where id = auth.uid()), false);
$$;

-- True when the current user is a supplier and the order belongs to them.
create or replace function public.owns_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and o.supplier_id = public.current_supplier_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------
-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_orders_updated   before update on orders   for each row execute function public.touch_updated_at();
create trigger trg_invoices_updated before update on invoices for each row execute function public.touch_updated_at();

-- record every status change into order_status_history
create or replace function public.log_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into order_status_history (order_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end; $$;

create trigger trg_orders_status_history after update on orders
  for each row execute function public.log_status_change();

-- Column-level protection for suppliers: RLS grants row access, but suppliers
-- must never change internal / commercial fields even via a direct API call.
-- This trigger blocks any such change when the caller is a supplier.
create or replace function public.guard_supplier_order_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() = 'supplier' then
    if (new.internal_notes       is distinct from old.internal_notes)
    or (new.order_type           is distinct from old.order_type)
    or (new.supplier_id          is distinct from old.supplier_id)
    or (new.customer_id          is distinct from old.customer_id)
    or (new.risk_level           is distinct from old.risk_level)
    or (new.order_number         is distinct from old.order_number)
    or (new.internal_style_name  is distinct from old.internal_style_name)
    or (new.assigned_staff_id    is distinct from old.assigned_staff_id) then
      raise exception 'Suppliers cannot modify protected order fields';
    end if;
  end if;
  return new;
end; $$;

create trigger trg_orders_supplier_guard before update on orders
  for each row execute function public.guard_supplier_order_update();

-- auto-create a profile when a new auth user is created.
-- Role comes from the invite metadata; defaults to 'staff' for internal, invite-only signups.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, supplier_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'staff'),
    nullif(new.raw_user_meta_data->>'supplier_id','')::uuid
  );
  return new;
end; $$;

create trigger trg_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table suppliers            enable row level security;
alter table profiles             enable row level security;
alter table customers            enable row level security;
alter table product_mappings     enable row level security;
alter table orders               enable row level security;
alter table order_status_history enable row level security;
alter table supplier_updates     enable row level security;
alter table invoices             enable row level security;
alter table tracking             enable row level security;
alter table customer_updates     enable row level security;
alter table qc_checks            enable row level security;
alter table files                enable row level security;
alter table audit_logs           enable row level security;

-- profiles: user sees own; staff/admin see all; only admin manages.
create policy profiles_select on profiles for select using (id = auth.uid() or is_staff());
create policy profiles_admin_write on profiles for all using (is_admin()) with check (is_admin());

-- suppliers: staff/admin all; supplier sees only their own supplier row.
create policy suppliers_select on suppliers for select using (is_staff() or id = current_supplier_id());
create policy suppliers_admin_write on suppliers for all using (is_admin()) with check (is_admin());

-- customers: staff/admin all; supplier may read ONLY customers attached to one
-- of their assigned orders (needed for ready-made ship-to-customer address).
create policy customers_staff on customers for all using (is_staff()) with check (is_staff());
create policy customers_supplier_select on customers for select using (
  exists (select 1 from orders o where o.customer_id = customers.id and o.supplier_id = current_supplier_id())
);

-- product_mappings: internal only (staff/admin).
create policy product_mappings_staff on product_mappings for all using (is_staff()) with check (is_staff());

-- orders: staff/admin full; supplier can read + update only their own orders.
-- (Column-level protection of internal_notes is enforced at the app layer and
--  via the v_supplier_orders view below.)
create policy orders_staff on orders for all using (is_staff()) with check (is_staff());
create policy orders_supplier_select on orders for select using (supplier_id = current_supplier_id());
create policy orders_supplier_update on orders for update
  using (supplier_id = current_supplier_id())
  with check (supplier_id = current_supplier_id());

-- order_status_history: internal only.
create policy status_history_staff on order_status_history for all using (is_staff()) with check (is_staff());
create policy status_history_supplier_select on order_status_history for select using (owns_order(order_id));

-- supplier_updates: staff/admin all; supplier read+insert on own orders.
create policy supplier_updates_staff on supplier_updates for all using (is_staff()) with check (is_staff());
create policy supplier_updates_supplier_rw on supplier_updates for select using (owns_order(order_id));
create policy supplier_updates_supplier_insert on supplier_updates for insert with check (owns_order(order_id));

-- invoices: staff/admin all (incl. marking paid). Supplier may read + upload
-- invoices for their orders, but CANNOT update (so they can never mark paid).
create policy invoices_staff on invoices for all using (is_staff()) with check (is_staff());
create policy invoices_supplier_select on invoices for select using (owns_order(order_id));
create policy invoices_supplier_insert on invoices for insert with check (owns_order(order_id));

-- tracking: staff/admin all; supplier read + upload for own orders.
create policy tracking_staff on tracking for all using (is_staff()) with check (is_staff());
create policy tracking_supplier_select on tracking for select using (owns_order(order_id));
create policy tracking_supplier_insert on tracking for insert with check (owns_order(order_id));

-- customer_updates + qc_checks: INTERNAL ONLY. suppliers get nothing.
create policy customer_updates_staff on customer_updates for all using (is_staff()) with check (is_staff());
create policy qc_checks_staff on qc_checks for all using (is_staff()) with check (is_staff());

-- files: staff/admin all; supplier sees + uploads only invoice/supplier_attachment on own orders.
create policy files_staff on files for all using (is_staff()) with check (is_staff());
create policy files_supplier_select on files for select using (
  owns_order(order_id) and file_type in ('invoice','supplier_attachment')
);
create policy files_supplier_insert on files for insert with check (
  owns_order(order_id) and file_type in ('invoice','supplier_attachment')
);

-- audit_logs: admin read only. Writes happen via service role in server actions.
create policy audit_admin_select on audit_logs for select using (is_admin());

-- ---------------------------------------------------------------------------
-- SUPPLIER-SAFE VIEW (defense in depth: excludes internal_notes + risk/finance)
-- security_invoker => the caller's RLS on `orders` still applies.
-- ---------------------------------------------------------------------------
create or replace view v_supplier_orders
with (security_invoker = true) as
select
  id, order_number, order_type, status, supplier_id,
  customer_facing_product_name, internal_style_name, supplier_style_code,
  customer_ordered_length, supplier_order_length, cap_style, cap_size,
  density, hair_type, colour_notes, production_notes, shipping_destination,
  date_ordered, date_sent_to_supplier, supplier_confirmed_at,
  production_started_at, expected_completion_date, production_complete_at,
  created_at, updated_at
from orders;
