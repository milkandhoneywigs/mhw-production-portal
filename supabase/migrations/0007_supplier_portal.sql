-- =============================================================================
-- 0007 — Supplier Portal redesign (additive only; no destructive changes)
--
-- A. Baselines live schema drift (order_messages, orders.supplier_price were
--    applied ad hoc and had no migration file).
-- B. New columns/tables for the sectioned supplier portal.
-- C. Enum additions (safe, additive).
-- D. Supplier payment terms (replaces the hard-coded 50% deposit assumption).
-- E. Security: suppliers lose ALL direct access to the customers table —
--    shipping info is served server-side (guarded, minimal columns) instead.
--    v_supplier_orders drops customer_ordered_length (owner rule 2026-07-14:
--    suppliers only ever see the production length).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. BASELINE DRIFT
-- ---------------------------------------------------------------------------
create table if not exists order_messages (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  sender_id   uuid references profiles(id) on delete set null,
  sender_name text,
  sender_role text,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_order_messages_order on order_messages(order_id);
alter table order_messages enable row level security;
drop policy if exists order_messages_staff on order_messages;
drop policy if exists order_messages_supplier_select on order_messages;
drop policy if exists order_messages_supplier_insert on order_messages;
create policy order_messages_staff on order_messages for all using (is_staff()) with check (is_staff());
create policy order_messages_supplier_select on order_messages for select using (owns_order(order_id));
create policy order_messages_supplier_insert on order_messages for insert with check (owns_order(order_id));

alter table orders add column if not exists supplier_price numeric(12,2);

-- ---------------------------------------------------------------------------
-- B. NEW COLUMNS / TABLES
-- ---------------------------------------------------------------------------
alter table orders add column if not exists supplier_reference text;
alter table orders add column if not exists quantity int not null default 1;
alter table orders add column if not exists cancelled_at timestamptz;
alter table orders add column if not exists on_hold_at timestamptz;

-- Bulk (restock) line-item progress
alter table restock_items add column if not exists colour text;
alter table restock_items add column if not exists density text;
alter table restock_items add column if not exists unit_price numeric(12,2);
alter table restock_items add column if not exists qty_completed int not null default 0;
alter table restock_items add column if not exists status text not null default 'pending';
alter table restock_items add column if not exists production_notes text;

-- Structured delay reporting (required when an order is overdue)
create table if not exists order_delays (
  id                        uuid primary key default gen_random_uuid(),
  order_id                  uuid not null references orders(id) on delete cascade,
  supplier_id               uuid references suppliers(id) on delete set null,
  reason                    text not null,
  revised_completion_date   date,
  message                   text,
  created_by                uuid references profiles(id) on delete set null,
  created_at                timestamptz not null default now()
);
create index if not exists idx_order_delays_order on order_delays(order_id);
alter table order_delays enable row level security;
drop policy if exists order_delays_staff on order_delays;
drop policy if exists order_delays_supplier_select on order_delays;
drop policy if exists order_delays_supplier_insert on order_delays;
create policy order_delays_staff on order_delays for all using (is_staff()) with check (is_staff());
create policy order_delays_supplier_select on order_delays for select using (owns_order(order_id));
create policy order_delays_supplier_insert on order_delays for insert with check (owns_order(order_id));

-- Message attachments + per-user read state (real unread counts)
alter table order_messages add column if not exists attachment_url text;
alter table order_messages add column if not exists attachment_name text;

create table if not exists order_message_reads (
  profile_id   uuid not null references profiles(id) on delete cascade,
  order_id     uuid not null references orders(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (profile_id, order_id)
);
alter table order_message_reads enable row level security;
drop policy if exists message_reads_own on order_message_reads;
create policy message_reads_own on order_message_reads for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- M&H feedback on an invoice (approval notes / rejection reason)
alter table invoices add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- C. ENUM ADDITIONS (additive — new values are not used within this migration)
-- ---------------------------------------------------------------------------
alter type order_status  add value if not exists 'cancelled';
alter type order_status  add value if not exists 'on_hold';
alter type invoice_status add value if not exists 'submitted';
alter type invoice_status add value if not exists 'approved';
alter type invoice_status add value if not exists 'changes_requested';
alter type invoice_status add value if not exists 'scheduled_for_payment';
alter type file_type add value if not exists 'packing_list';
alter type file_type add value if not exists 'production_photo';

-- ---------------------------------------------------------------------------
-- D. PAYMENT TERMS ('deposit_50' preserves existing behaviour exactly)
-- ---------------------------------------------------------------------------
alter table suppliers add column if not exists payment_terms text not null default 'deposit_50';

-- ---------------------------------------------------------------------------
-- E. SECURITY
-- ---------------------------------------------------------------------------
-- Suppliers lose ALL direct read access to customers. The supplier order page
-- shows a shipping block (name/address/phone, never email) fetched server-side
-- with the service role AFTER verifying: order belongs to the supplier AND is
-- confirmed AND ships customer_direct.
drop policy if exists customers_supplier_select on customers;

-- Suppliers may now also upload/see QC + production photos and packing lists.
drop policy if exists files_supplier_select on files;
drop policy if exists files_supplier_insert on files;
create policy files_supplier_select on files for select using (
  owns_order(order_id) and file_type in ('invoice','supplier_attachment','qc_photo','production_photo','packing_list')
);
create policy files_supplier_insert on files for insert with check (
  owns_order(order_id) and file_type in ('invoice','supplier_attachment','qc_photo','production_photo','packing_list')
);

-- v_supplier_orders: drop customer_ordered_length; expose supplier_reference,
-- quantity + lifecycle timestamps the portal sections need.
drop view if exists v_supplier_orders;
create view v_supplier_orders
with (security_invoker = true) as
select
  id, order_number, supplier_reference, order_type, status, supplier_id,
  customer_facing_product_name, internal_style_name, supplier_style_code,
  supplier_order_length, cap_style, cap_size,
  density, hair_type, colour_notes, production_notes, shipping_destination,
  quantity, supplier_price,
  date_ordered, date_sent_to_supplier, supplier_confirmed_at,
  production_started_at, expected_completion_date, production_complete_at,
  shipped_to_showroom_at, cancelled_at, on_hold_at,
  created_at, updated_at
from orders;

-- ---------------------------------------------------------------------------
-- STORAGE: private bucket for order files (photos / invoices / packing lists).
-- Path convention: orders/<order_id>/<filename> — policies key off segment 2.
-- (Bucket row is created via the Storage API; policies live here.)
-- ---------------------------------------------------------------------------
drop policy if exists order_files_staff on storage.objects;
drop policy if exists order_files_supplier on storage.objects;
create policy order_files_staff on storage.objects for all
  using (bucket_id = 'order-files' and is_staff())
  with check (bucket_id = 'order-files' and is_staff());
create policy order_files_supplier on storage.objects for all
  using (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = 'orders'
    and owns_order(((storage.foldername(name))[2])::uuid)
  )
  with check (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = 'orders'
    and owns_order(((storage.foldername(name))[2])::uuid)
  );
