# CTO Audit Report — FabBeds / UAEWB Platform

**Date:** 20 November 2026
**Repository:** https://github.com/rammyyadav-dot/fabbeds-b2b-sales-portal (branch `main`)
**Scope:** Full Zite workspace: Sales Portal (B2B agent-facing), Admin Extranet, shared packages, database schema, docs and tests.

---

## 1. Repository clone verification

Every file in the workspace was hashed with `git hash-object` and compared against the GitHub tree for `main`.

| Check | Result |
|---|---|
| Files in workspace (tracked + untracked, not git-ignored) | **626** |
| Files on GitHub | **627** (626 + README.md) |
| Missing on GitHub | **0** |
| Content mismatches (SHA differs) | **0** |
| Workspace size | ~27.8 MB |

Status: **complete, byte-identical clone.**

| Area | Files |
|---|---|
| `apps/sales-user-side-b2b-access` | Sales Portal |
| `apps/admin-extranet` | Admin Extranet |
| `apps/` total | 544 |
| `packages/components` (shared UI design system) | 64 |
| Root config (package.json, lockfile, zite.config.json, zite.schema.json, zite.permissions.json, tsconfig, .gitignore, zite.lock) | 8 |
| `docs/` | 4 (+ this report) |
| `shared/` (attraction markup / policy / taxonomy) | 3 |
| `tests/` | 2 |
| `.zite/db.ts` (generated database SDK) | 1 |

Not in the repo, on purpose: `node_modules/`, `.env.local`, and the secrets and integration tokens. Those live in Zite's encrypted Secrets and Integrations, never in source.

---

## 2. Codebase inventory

| Metric | Sales Portal | Admin Extranet |
|---|---|---|
| Backend endpoints (`src/api`) | 39 | 158 |
| Endpoints with `authenticated: true` | 1 | 69 |
| Pages | 29 | 38 |
| Components | 54 | 94 |
| Lines of TS/TSX | ~22,900 | ~36,800 |
| Endpoints using raw SQL (`zite.sql`) | 12 | 16 |

**Stack:** React + Vite + TypeScript, Tailwind + shadcn/ui, endpoints on Cloudflare Workers (Zite runtime), with Zite Database (Postgres-backed) as the single shared database.

**Pricing architecture:** Property → Room Type → Rate Plan → Meal Plan (controlled master) → Daily Rate → Availability. Daily rates carry integrity flags. Quarantined rates are excluded per rate option, and valid setups with no tariff show as **On Request**.

---

## 3. Findings

### 🔴 CRITICAL — Admin Extranet endpoints callable without sign-in
**89 of 158** Admin Extranet endpoints have no `authenticated: true` and no role guard (`requireAdmin` / `requireFinance` / `requireInventoryGovernor` / `context.user` check). Every Zite endpoint is a plain HTTP URL, so anyone with the URL can call them directly, even if the screens are hidden behind a login. Examples:
- **Destructive:** `deleteHotel`, `deleteRatePlan`, `deleteRoomType`, `deleteReservation`, `deleteMarkupRule`, `deletePromotion`, `deleteSeason`
- **Commercial writes:** `saveHotel`, `saveRatePlan`, `saveDailyRate`, `bulkSaveDailyRates`, `saveMarkupRule`, `saveNetRate`, `updateBookingStatus`, `commitRateImportJob`
- **Data exposure:** `getUsers`, `getBookings`, `getReservations`, `getReservationDetail`, `getNetRates`, `getMarkupRules`, `getDashboardStats`

**Fix:** add `authenticated: true` plus the existing role guard (`requireAdmin`) to every one of them. Leave only partner-login endpoints public, and only where that is truly needed.

### 🔴 CRITICAL — Public source repository
The repo is **public**. It exposes the pricing engine, markup logic, the admin back-office endpoint names, and the internal `hotel-pricing-repair-report`. Combined with the finding above, this hands an attacker a map of the unprotected endpoints.
**Fix:** set the repo to **Private** right away (GitHub → Settings → Danger Zone → Change visibility).

### 🟠 HIGH — Sales Portal public write endpoints
18 Sales Portal endpoints write data without sign-in (booking inquiries, holds, visa applications, voucher/invoice generation, partner sign-in/up). Guest checkout is intended, but:
- `generateHotelInvoice` / `generateHotelVoucher` / `generateAttraction*` should confirm the caller owns the booking (reference + agency email, or partner session).
- `createMultiRoomRateHold` / `createAttractionHold` / `releaseMultiRoomRateHold` can be abused to hold or release inventory. They need rate-limiting and ownership checks.

### 🟡 MEDIUM — Duplicated logic across apps
Attraction markup, pricing and image helpers exist in both apps (`src/lib/allAttractionRecords.ts`, `attractionMarkup`) as well as in `shared/`. Move them into one shared package so pricing can't drift between admin preview and agent price.

### 🟡 MEDIUM — Test coverage
Only 2 test files (attractions). No automated tests cover hotel pricing, markup, quarantine or the On Request fallback, which are the highest-revenue paths.

### 🟢 Positive
- Rate-plan-centred integrity model in place: Meal Plan master, cancellation type, daily-rate integrity status, Property Readiness, Integrity Centre.
- Deletes of rate plans and room types are blocked when dependants exist, with deactivate offered instead.
- Aggregations use SQL (row-limit-safe).
- One agency credit ledger across hotels, attractions and transfers.
- No hard-coded secrets found in source.

---

## 4. Recommended next actions (priority order)
1. Make the GitHub repo **private**.
2. Lock down the 89 unguarded Admin Extranet endpoints.
3. Add ownership checks to the Sales Portal voucher/invoice and inventory-hold endpoints.
4. Consolidate duplicated pricing/markup code into `shared/`.
5. Add regression tests for hotel pricing, markup and quarantine.
6. Re-sync GitHub after each release (this repo is a snapshot; it does not auto-sync).
