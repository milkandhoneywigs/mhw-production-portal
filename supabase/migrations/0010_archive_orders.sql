-- 0010_archive_orders.sql
-- Reversible "remove from portal" = ARCHIVE (owner choice 2026-08-12).
-- Fulfilled (Shopify) and supplier-finished orders are archived, not deleted:
-- they disappear from every active list/dashboard but the record is kept and can
-- be restored. archived_at IS NULL = active; NOT NULL = archived.

alter table public.orders add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists archived_reason text;

-- Partial index: fast "active orders" scans (the common case).
create index if not exists orders_archived_at_idx
  on public.orders (archived_at) where archived_at is not null;

-- Hide archived orders from the supplier portal too. Same PII-stripped view as
-- 0009, with a single WHERE guard so archived orders never reach the supplier.
drop view if exists v_supplier_orders;
create view v_supplier_orders
with (security_invoker = true) as
select
  id, order_number, supplier_reference, order_type, status, supplier_id, source,
  customer_facing_product_name, internal_style_name, supplier_style_code,
  supplier_order_length, cap_style, cap_size,
  density, hair_type, colour_notes, production_notes, shipping_destination,
  quantity, supplier_price,
  date_ordered, date_sent_to_supplier, supplier_confirmed_at,
  production_started_at, expected_completion_date, production_complete_at,
  shipped_to_showroom_at, cancelled_at, on_hold_at,
  created_at, updated_at
from orders
where archived_at is null;
