# MHW Production Portal — Backlog (living)

_Last updated: 2026-07-01. Captures every requirement raised so nothing is dropped._

## ✅ Done (live in the database)
- 95 outstanding CBW orders imported (customers + China Best Wigs supplier). Samples excluded; already-fulfilled excluded.
- Business rules applied: **hair → Peruvian** (unless specified), **density → 150%** (unless specified), **bobs** order at the same length (no −2″), `INCG → INCH` fixed.
- **ETA** = order date + 40 business days, on all 95 orders.
- **Overdue → HIGH RISK**: 36 orders past their 40-day ETA flagged high.

## 🙋 Needs your input (data)
- **Cap size for 21 orders** — not in the sheet or derivable (they only list a cap *construction* like 13×6). List already provided.
- **Length check** — ~15 Shopify-sourced orders had length mis-read from "13 x 6" (shows 6"). Need the real length for those (overlaps the 21 above).

## 🔧 Portal features requested (code — need build + deploy)
| # | Feature | Notes |
|---|---|---|
| 1 | **Show ETA on each order** (order detail + list) | data exists; needs UI |
| 2 | **High-risk badge** for anything over 40 business days | logic exists; needs UI surfacing |
| 3 | **Per-order messaging** — staff request updates from the supplier, supplier replies | extend `supplier_updates` into a thread |
| 4 | **"Production not started" view** + **unpaid orders list** | status filter + a not-started/awaiting-payment view |
| 5 | **Billing ↔ invoice ↔ order**: an invoice marks which order(s) it's for; clicking **"Payment made"** auto-updates those orders | order-link + paid flow (partly built) |
| 6 | **Ready-made dispatch plugin**: supplier adds tracking → **auto-pushes tracking to the Shopify order** | needs Shopify Admin API integration + a store token |
| 7 | **Delete orders** | admin/staff only, with confirm + audit log |

## ⛔ Open blocker
- **Deployed login** (Vercel env var / Type-error fix) — is the live portal working now? All the UI features above deploy there, so we need it green.

## Suggested build order
1. Confirm the deploy is working (login).
2. Features 1 + 2 (ETA + risk UI) — small, high value, data already there.
3. Feature 5 (billing/invoice→order + payment-made) — you asked for this twice.
4. Feature 4 (not-started + unpaid views).
5. Feature 3 (messaging).
6. Feature 6 (ready-made tracking → Shopify) — needs a Shopify token + is the biggest.
