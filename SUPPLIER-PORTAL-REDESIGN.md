# Supplier Portal Redesign — Audit & Implementation Plan

_Stage 1 (Audit) + Stage 2 (Proposed structure). 2026-07-14. No code changes made yet
(one staged local edit: `SUPPLIER_VISIBLE_ORDER_TYPES` phase constant in `src/lib/constants.ts`)._

---

## STAGE 1 — AUDIT

### 1.1 Stack & current structure

- **Next.js App Router + Supabase (Postgres/Auth/RLS) + Tailwind**, deployed on Vercel.
  ~9,400 lines of TS/TSX. No component library — a small bespoke kit
  (`src/components/ui.tsx`: PageHeader, StatCard, Section, EmptyState; `Badges.tsx`:
  StageBadge, StatusBadge, OrderTypeBadge, RiskBadge, Flag) in the cream/sand/honey/ink palette.
- Three roles on `profiles.role`: **admin, staff, supplier** (+ `profiles.supplier_id` linking a
  supplier login to a `suppliers` row).

### 1.2 Current routes

| Area | Routes | Guard |
|---|---|---|
| Staff/admin `(app)` | `/dashboard`, `/orders`, `/orders/new`, `/orders/restock`, `/orders/[id]`, `/inbox`, `/qc`, `/customer-updates`, `/product-mappings`, `/production` | `requireStaff()` per page |
| Admin only | `/billing`, `/settings/users`, `/command-centre/**` (own `(command)` layout) | `requireAdmin()` |
| Supplier | **`/supplier` — one long "My Orders" page**, rendered inside the SAME `(app)` sidebar layout | `requireSupplier()` |
| Auth | `/login`, `/auth/signout`; middleware refreshes session + redirects unauthenticated → `/login` | middleware + per-page |
| APIs | `/api/lookup`, `/api/financials/snapshot`, `/api/agents/update`, `/api/pulse`, `/api/trading/ledger`, `/api/shopify/order`, `/api/marketing/blended` | shared-secret guarded; not supplier-facing |

Server-side permission checks already exist on every page and server action (not just hidden UI). ✅

### 1.3 Current supplier experience (the problem)

One page, 7 status buckets mixing ready-made, made-to-order and bulk stock. Every order is a large
card with all fields + 4–6 action buttons always visible (Confirm / Add price / Add update /
Upload tracking / Upload invoice) regardless of status. Messages render inline under every card.
Nav = single "My Orders" item. Sidebar is fixed-width — **not mobile responsive**. No search, no
pagination, no unread state, no confirmation modals, no success/error toasts.

### 1.4 Database models (relevant to suppliers)

- `suppliers`, `profiles`, `customers`
- `orders` — 38 columns; supplier-safe fields + `internal_notes` (internal-only), `supplier_price`,
  full production timestamp trail (`supplier_confirmed_at`, `production_started_at`,
  `expected_completion_date`, `production_complete_at`, `shipped_to_showroom_at`, …)
- `order_status_history` — every status change auto-logged by trigger ✅
- `supplier_updates` — typed event feed (confirmation, invoice_uploaded, production_update,
  production_complete, tracking_uploaded, delay_notice, general_note) → **ready-made timeline source** ✅
- `invoices` — type (initial/balance/other), status (uploaded/payment_required/paid/disputed/cancelled),
  amount, `file_url` (plain text), payment method/reference/paid_at
- `tracking` — multiple rows per order (already supports multiple tracking numbers) ✅
- `restock_items` — bulk-order line items (style, code, length, cap, qty, position) — **no per-line
  status, no qty-completed, no unit price**
- `order_messages` — per-order chat (sender name/role, body) — **no attachments, no read state**
- `files` — file_type enum (invoice, qc_photo, supplier_attachment, other), `file_url` plain text
- `audit_logs` + `logAudit()` wired into every action ✅
- View `v_supplier_orders` (`security_invoker`) — excludes internal_notes, risk, financials ✅

### 1.5 Existing status machine (single `order_status` enum, both workflows)

- **Ready-made:** `new_ready_made_order → supplier_notified → awaiting_dhl_tracking →
  tracking_uploaded → customer_notified → completed`
- **Made-to-order:** `new_made_to_order → awaiting_supplier_confirmation → invoice_uploaded →
  payment_required → payment_paid → in_production → production_update_due → production_complete →
  balance_payment_required → balance_paid → shipped_to_showroom → arrived_at_showroom → qc_required →
  qc_passed → ready_to_dispatch → dispatched_to_customer → completed`
  (+ `delayed_at_risk`, `manager_review_required`)
- **Missing entirely:** `cancelled`, `on_hold` (spec requires both as tabs).

### 1.6 Existing permission logic (what's already solid)

- RLS ON for every table; SECURITY-DEFINER helpers (`current_role`, `current_supplier_id`,
  `is_staff`, `is_admin`, `owns_order`) prevent recursion.
- Suppliers: SELECT/UPDATE only own orders; column-guard **trigger** blocks suppliers changing
  protected fields even via direct API; can insert but never update invoices (can't mark paid);
  customer_updates + qc_checks + product_mappings fully hidden; audit_logs admin-only.
- All supplier server actions go through the authenticated client → RLS enforced server-side. ✅

### 1.7 Security gaps found (must fix in this build)

1. **Customer PII pre-confirmation** — `customers_supplier_select` RLS lets a supplier read the FULL
   customer row (name, email, phone, full address) for any assigned order at ANY status. Spec:
   nothing until confirmed, then shipping-only fields. Needs an RLS + view fix.
2. **No file storage** — "uploads" are pasted text URLs (`invoices.file_url`, `files.file_url`).
   Only storage bucket is public `outlet-covers`. Needs a private `order-files` bucket with
   owner-scoped storage policies + real upload components.
3. **Suppliers can't upload QC photos** — files RLS restricts them to `invoice`/`supplier_attachment`,
   but the MTO workflow requires QC photo upload. Widen policy (and add `packing_list` file type).
4. **Schema drift** — `order_messages`, `orders.supplier_price` (and command-centre extras) exist in
   the live DB with **no migration file**. Must be baselined in the next migration so the repo can
   rebuild the schema.
5. **Auto 50% deposit** — `supplierSetPrice` always creates a 50% deposit invoice;
   `supplierMarkProductionComplete` always raises the balance invoice. Spec: only when payment terms
   require it. Make term-driven.

### 1.8 What can be reused as-is

- The entire RLS model + helpers + column-guard trigger (extend, don't replace).
- All supplier server actions (confirm / price / production-complete / tracking / update / invoice /
  message) — they're correct, RLS-backed and audited; the redesign changes **when they're offered**, not what they do.
- `supplier_updates` + `order_status_history` → production timeline, already populated historically.
- `tracking` multi-row design (partial shipments already possible).
- Status enum + labels/tones in `constants.ts` (map to supplier-facing tab names; add 2 values).
- Badge components (already colour + text, never colour-only ✅), ui.tsx kit, brand palette.
- Auth/middleware/login — untouched.

### 1.9 Risks before implementation

- **Live supplier login exists** (CBW created today) — build behind the phase flag so nothing
  half-finished is visible; ship in one deploy.
- **Enum changes** (`cancelled`, `on_hold`, invoice statuses) are additive `ALTER TYPE … ADD VALUE` —
  safe, but irreversible in Postgres; naming must be final.
- **Historical data must keep loading** — 109 orders, existing messages/invoices/tracking; no
  destructive column changes, only additive migrations.
- **`/supplier` inside `(app)` layout** — moving to its own route group changes the supplier's shell
  only; staff pages untouched, but the shared layout's notification-bell query moves with it.
- **Data discrepancies right now** (owner decisions needed, see §3).

---

## STAGE 2 — PROPOSED STRUCTURE

### 2.1 New route structure (new `(supplier)` route group, own layout)

```
src/app/(supplier)/supplier/
  layout.tsx              ← supplier-only shell: sidebar (desktop) / hamburger (mobile),
                            home icon, 5 sections, notification badges, account + logout at bottom
  page.tsx                ← DASHBOARD: "Tasks requiring action" + summary tiles
  ready-to-ship/page.tsx  ← Section 1 (summary cards, tabs, table)
  made-to-order/page.tsx  ← Section 2
  bulk-orders/page.tsx    ← Section 3 (parent orders + expandable line items)
  payments/page.tsx       ← Section 4 (tabs: price requests / deposit / final / submitted / approved / paid / rejected)
  messages/page.tsx       ← Section 5 (central inbox, filters, unread)
  orders/[id]/page.tsx    ← order detail: header / product / timeline / files / messages / financials
```

Old `(app)/supplier/page.tsx` → redirect to `/supplier` (new dashboard). Staff/admin routes unchanged.
`requireSupplier()` in the `(supplier)` layout + every page; all data via RLS-scoped client (no service key).

**Phased rollout:** `SUPPLIER_VISIBLE_ORDER_TYPES` (already staged) drives BOTH the sidebar items and
every query. Phase 1 = `['ready_made']` → CBW sees Dashboard, Ready to Ship, Payments, Messages.
Adding `'made_to_order'` / `'stock'` later unlocks the other sections with zero rework.

### 2.2 Component hierarchy (all reusable, under `src/components/supplier/`)

```
SupplierShell/Sidebar (mobile collapse, badge counts)
SummaryCards          (row of StatCard-style tiles per section)
OrderTable            (compact rows; search / status tabs / sort / pagination; row → detail)
OrderDetailHeader     (number, type, status, due date, ONE primary action)
ProductSpecs          (style/code/colour/lengths/cap/size/density/qty/notes)
ProductionTimeline    (from order_status_history + supplier_updates + tracking + invoices)
ProgressSteps         (Confirmed → Production → QC → Approved → Shipped → Received)
ProgressBar           (bulk: "72 of 120 units — 60%")
FileUpload            (→ private Supabase storage bucket; images + PDF)
FileList              (photos, invoices, packing lists, tracking docs)
MessageThread         (extends OrderMessages: attachments, read state)
ConfirmModal          (confirm order / production complete / tracking / invoice / cancel-report)
Toast                 (success/error notifications)
StatusBadge           (existing tones: blue=new, purple=production, orange=due/approval,
                       red=overdue/blocked, green=approved/shipped/paid, grey=done/cancelled)
DelayReportForm       (reason + revised date + optional message/photo — required when overdue)
PriceSubmitForm       (with confirmation screen before any invoice is created)
```

### 2.3 Database changes (one migration: `0007_supplier_portal.sql`)

**A. Baseline the drift** (idempotent `create table if not exists` / `add column if not exists`):
`order_messages` + its 3 RLS policies; `orders.supplier_price`.

**B. Additive columns / tables:**
- `orders.supplier_reference text` — supplier's own order ref (searchable)
- `orders.quantity int not null default 1`
- `orders.cancelled_at timestamptz`, `orders.on_hold_at timestamptz`
- `restock_items`: `colour text`, `density text`, `unit_price numeric(12,2)`,
  `qty_completed int not null default 0`, `status text default 'pending'`, `production_notes text`
- `order_delays` (order_id, reason, revised_completion_date, message, created_by, created_at)
  — structured overdue reporting; RLS same shape as supplier_updates
- `order_messages.attachment_url text`, `attachment_type text`
- `order_message_reads` (profile_id, order_id, last_read_at) — real unread counts
- `invoices.notes text` — M&H feedback/rejection reason
- `invoices.supplier_invoice_number` already covered by `invoice_number`; no change

**C. Enum additions (additive, safe):**
- `order_status`: + `cancelled`, + `on_hold`
- `invoice_status`: + `submitted`, + `approved`, + `changes_requested`, + `scheduled_for_payment`
- `file_type`: + `packing_list`, + `production_photo`

**D. Payment terms (kills the hard-coded 50%):**
- `suppliers.payment_terms text not null default 'deposit_50'` (`deposit_50` | `full_on_completion` |
  `net_terms`) — `supplierSetPrice` / `supplierMarkProductionComplete` only auto-raise deposit/balance
  invoices when terms say so.

**E. Security fixes:**
- Replace `customers_supplier_select` RLS: only when the linked order is **confirmed**
  (`supplier_confirmed_at is not null`) AND ships `customer_direct`.
- New view `v_supplier_shipping` (security_invoker): name, address lines, suburb/state/postcode/
  country, phone — **no email**. Supplier UI reads shipping ONLY from this view.
- Drop `customer_ordered_length` from `v_supplier_orders` — **owner rule (2026-07-14): the supplier
  only ever sees the production length ("length to make"), never the customer-ordered length.**
- Widen `files` supplier RLS to include `qc_photo`, `production_photo`, `packing_list`.
- **Private storage bucket `order-files`** with policies: staff full; supplier read/write only under
  `orders/<order_id>/` paths where `owns_order(order_id)`.

**F. Audit** — existing `audit_logs` + `logAudit()` already covers confirm/price/status/production/
invoice/tracking/message; add entries for the new actions (delay report, qty update, packing list).

### 2.4 Supplier-facing status mapping (no invented states — tabs map to the enum)

| Section tab | Underlying statuses |
|---|---|
| RTS · New | `new_ready_made_order` |
| RTS · Confirmed | `supplier_notified` |
| RTS · Ready to Dispatch | `awaiting_dhl_tracking` |
| RTS · Shipped | `tracking_uploaded`, `customer_notified` |
| RTS · Completed | `completed` |
| RTS · Cancelled | `cancelled` |
| MTO · New | `new_made_to_order`, `awaiting_supplier_confirmation` |
| MTO · Confirmed | `invoice_uploaded`, `payment_required`, `payment_paid` |
| MTO · In Production | `in_production`, `production_update_due`, `delayed_at_risk` |
| MTO · Quality Check | `production_complete`, `qc_required`, `manager_review_required` |
| MTO · Ready to Ship | `balance_payment_required`, `balance_paid`, `ready_to_dispatch` |
| MTO · Shipped | `shipped_to_showroom`, `arrived_at_showroom`, `dispatched_to_customer` |
| MTO · Completed / On Hold / Cancelled | `completed` / `on_hold` / `cancelled` |

Status-driven actions: each status exposes exactly ONE primary action (+ "Report a problem"
always available). E.g. RTS: New → **Confirm stock**; Confirmed → **Add price** (if required) /
**Mark ready to dispatch**; Ready to Dispatch → **Upload tracking**; Shipped → **Upload invoice**.

### 2.5 Permission model (summary)

- Supplier sees: own orders (RLS), own messages, own invoices/payments, shipping info only
  post-confirmation via `v_supplier_shipping`, own files under own order paths.
- Supplier never sees: other suppliers, customer email, payment data, retail prices/margins
  (`supplier_price` is their own price — fine), Shopify links, `internal_notes`
  (view + column guard), business reporting.
- Admin/staff: unchanged full management; billing stays admin-only.
- Every page re-checks the role server-side; every action goes through RLS; direct-URL access to
  another order's detail page 404s via RLS empty result.

### 2.6 Migration & build plan (Stage 3 order)

1. **Migration 0007** + storage bucket + policies (additive only, tested against live schema copy).
2. **`(supplier)` shell**: layout, responsive sidebar, badges, dashboard with Tasks-requiring-action.
3. **Ready to Ship section** (Phase 1 priority) + order detail page + confirm/price/dispatch/tracking/
   invoice flows with modals + toasts.
4. **Payments/Invoicing section** (price requests, deposit/final invoices, statuses, files).
5. **Messages inbox** (central thread list, unread, attachments; order-page threads stay linked).
6. **Made to Order section** (progress steps, production updates, QC photos, delay reporting).
7. **Bulk Store Orders section** (line items, qty progress, partial shipments, packing list).
8. Behind `SUPPLIER_VISIBLE_ORDER_TYPES` the whole time; single deploy at the end of each section is
   safe — hidden sections never render.

### 2.7 Stage 4 test checklist

- CBW login sees ONLY assigned ready-made orders; direct URLs to other orders/suppliers' data return
  nothing (RLS), staff routes redirect.
- RM vs MTO vs Bulk correctly separated; historical orders/messages/invoices/tracking all load.
- Invoice status transitions; tracking upload moves status correctly for direct-vs-showroom.
- Messages from order pages appear in inbox, unread badges correct.
- Mobile layout (sidebar collapse, tables → cards).
- Pre-confirmation: no customer info; post-confirmation: shipping block only, no email.
- Build passes; existing staff portal unaffected.

---

## 3. DATA DECISIONS NEEDED BEFORE PHASE 1 GOES LIVE (owner input)

1. **#33448 (Jess Lomen — LOUISE 18" Chocolate Brown, READY MADE, paid 14 Jul)** is in Shopify but
   NOT in the portal. → Create it as a ready-made order assigned to CBW? (Shipping to Mill Park VIC.)
2. **#33408 (Megan MacVicar)** — portal says PAYTON **10 INCH BOB**; Shopify variant says
   **12 Inch Bob** (Lived In Blonde). Which is correct for CBW to ship? Shopify order also contains a
   second item (CUSTOM COLOUR 13×6, 12", $1,223.58) not tracked in the portal — should it become a
   made-to-order record?
3. **MH-20260701-8579 (Emily Munn — PAYTON 10" bob, manual entry 1 Jul)** — no matching Shopify
   order. You said only TWO ready-made orders exist. Shipped already / duplicate / in-store sale?
   Options: mark completed, or unassign from CBW, or delete (with audit note).
