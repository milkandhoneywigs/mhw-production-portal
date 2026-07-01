# Milk & Honey Wigs — Production Portal

Internal + supplier-facing production management portal. Replaces Monday.com and the
production spreadsheets with one system for online, in-store/custom, and supplier-managed
human-hair wig production.

**The portal does NOT process payments.** Supplier payments are made manually (bank transfer /
PayPal) outside the portal. The portal only *records* invoice + payment status.

## Stack
- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** — Postgres, Auth, Storage, Row Level Security
- **Vercel**-ready (no local-only dependencies)

## Roles
| Role | Can do |
|---|---|
| **admin** | Everything, incl. create users, manage billing, all reporting |
| **staff** | Create/update orders, run QC, dispatch, notes, view production, billing |
| **supplier** | See ONLY their assigned orders; update production status, upload invoices + tracking, add notes. Cannot see internal notes, financial reporting, other suppliers' or unrelated customer/order data, and cannot mark payments paid. |

Supplier isolation is enforced three ways: **RLS** (row access by `supplier_id`), a
**supplier-safe view** (`v_supplier_orders`, excludes internal notes), and a **DB trigger**
that blocks suppliers from changing protected columns.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`
   (seeds the 26 product mappings).
3. Create a **Storage bucket** named `files` (for invoice / QC photo uploads) — private.
4. Grab your Project URL, `anon` key, and `service_role` key (Settings → API).

### 2. Environment
Copy `.env.example` to `.env.local` and fill in the three values. In Vercel, add the same
under Project Settings → Environment Variables.

### 3. Install & run
```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # verify types
```

### 4. First admin user
The app creates users via the admin Settings page, but you need one admin to start. Either:
- **Supabase dashboard** → Authentication → Add user, then in SQL:
  `update profiles set role = 'admin' where email = 'you@example.com';`
- After that, log in and create the rest of the team (staff / supplier) from **Users & Settings**.

Suppliers must be linked to a `suppliers` row. Add suppliers in the Supabase table editor (or
extend the admin UI), then create the supplier user and link them.

### 5. Deploy to Vercel
Push to a Git repo, import into Vercel, set the env vars, deploy. `npm run build` runs cleanly.

## Key business logic (in `src/lib/business/`)
- **length.ts** — supplier length = customer length − 2". Bob / custom / unclear / unparseable
  → flagged `needs_review` (never guessed).
- **classify.ts** — order type, initial status, shipping destination.
- **risk.ts** — low/medium/high from overdue production, ageing unpaid invoices (24h → medium,
  48h → high) and blocked-shipment logic.
- **supplier-instruction.ts** — the supplier-safe instruction generator (no internal/financial
  data), with fixed shipping wording per order type.
- **customer-update.ts** — draft milestone messages (draft/approved/sent; never auto-sent in v1).

These are wrapped by the AI seam in `src/lib/ai.ts`; swap in AI later without changing call sites.

## Pages
Login · Dashboard · Production Orders · Order detail · Add manual order · Supplier dashboard ·
Billing · Product mapping · Customer update queue · QC queue · Users & Settings.

## v1 scope notes
- No emails are sent. Supplier instructions and customer updates are generated + logged only.
- File uploads use a `file_url` field; wire the Supabase Storage upload widget to populate it.
- Order sync from Shopify / Fresha is modelled (`source` field) but the importer is not built yet.
