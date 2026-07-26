-- 0009_supplier_instore_visibility.sql
-- Widen supplier visibility (owner rule 2026-07-27): push STORE RESTOCK (order_type
-- 'stock') and IN-STORE made-to-order to the supplier, while WITHHOLDING online
-- (Shopify-sourced) made-to-order.
--
-- The app distinguishes in-store vs online via orders.source. Ready-made and stock
-- are shown regardless of source; only made_to_order is source-gated (see
-- fetchSupplierOrders + SUPPLIER_ONLINE_SOURCE in the app).
--
-- This migration only ADDS the `source` channel enum to the PII-stripped supplier
-- view. `source` (shopify/fresha/manual/custom/other) is a fulfilment channel, not
-- customer PII. All other columns are unchanged from 0007. security_invoker keeps
-- the caller's RLS on `orders` in force.

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
from orders;
