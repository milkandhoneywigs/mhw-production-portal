-- Transfer receipt uploaded by admin when marking an invoice paid, so the
-- supplier can see proof of payment. Stored as an order-files bucket path.
alter table invoices add column if not exists receipt_url text;
