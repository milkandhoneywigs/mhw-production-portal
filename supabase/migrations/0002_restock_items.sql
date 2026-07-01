-- Store restock line items. A restock order (orders.order_type = 'stock') has a
-- sheet of styles to restock a showroom; each row is one line. Priced as one
-- order via the normal supplier Add Price -> 50% deposit flow.

create table if not exists restock_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  style_name          text not null,
  supplier_style_code text,
  length              text,
  cap_size            text,
  quantity            int not null default 1,
  position            int not null default 0,
  created_at          timestamptz not null default now()
);
create index if not exists restock_items_order_idx on restock_items(order_id);

alter table restock_items enable row level security;

-- Staff/admin: full access. Supplier: read the items for their own orders.
drop policy if exists restock_items_staff on restock_items;
drop policy if exists restock_items_supplier_select on restock_items;
create policy restock_items_staff on restock_items for all using (is_staff()) with check (is_staff());
create policy restock_items_supplier_select on restock_items for select using (owns_order(order_id));
