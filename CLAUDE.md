# Nocfinity Shop: project rules

E-commerce test project: Laravel 12 REST API (`backend/`) + Next.js App Router storefront and admin panel (`frontend/`) + MySQL 8. Every change must keep to these rules.

## Stack

- Backend: Laravel 12, PHP 8.4, Sanctum bearer tokens, MySQL 8, Stripe PHP SDK. Runs in Docker (`docker compose up`).
- Frontend: Next.js 15 App Router, TypeScript (strict), Tailwind CSS v4. Talks to Laravel only through the REST API; no Blade views for UI.
- Mail: Mailpit (SMTP `1025`, UI `http://localhost:8025`).

## Running things

- Artisan, Composer and tests go through Docker. PHP is not installed on the host:
  - `docker compose run --rm --no-deps -T -e CONTAINER_ROLE=cli app php artisan <cmd>`
  - `docker compose run --rm --no-deps -T -e CONTAINER_ROLE=cli app composer <cmd>`
  - Tests: `docker compose run --rm -T -e CONTAINER_ROLE=cli app php artisan test`
- Frontend: `cd frontend && npm run dev | build | lint | typecheck | test`.
- End-to-end: start the stack with `docker-compose.e2e.yml` on top, then `cd frontend && npm run e2e` (see README).
- New logic gets a unit test next to it (`*.test.ts`); new user flows get a Playwright spec in `frontend/e2e/`.
- Verify every feature by running it (tests, curl or the browser), not only by building it.

## Git

- One commit per feature or concern, using Conventional Commits (`feat(backend): ...`, `fix(frontend): ...`, `test: ...`, `docs: ...`).
- Never add a `Co-Authored-By` or any AI attribution trailer to commits.
- Never commit `.env`, secrets, `vendor/`, `node_modules/`, or `.next/`.

## Code style

- Comments: at most 1-2 short lines, and only where the *why* is not obvious. No comment blocks, no restating the code.
- Small, focused classes. Business rules live in `app/Services` (or Actions), not in controllers.
- Controllers stay thin: validate with a FormRequest, call a service, return an API Resource.
- Name things for the domain (`OrderStatus::Shipped`, `StockService::reserve`), not the mechanism.
- Frontend: server components by default; add `"use client"` only where interaction needs it. Shared UI lives in `src/components`.

## API conventions

- Prefix `/api/v1`. Customer routes use guard `auth:customer`; admin routes use `/api/v1/admin/*` with guard `auth:admin` plus `permission:<name>` middleware.
- Success: `{ "data": ..., "meta"?: ..., "links"?: ... }` via API Resources. Lists are always paginated and carry pagination `meta`.
- Error: `{ "message": string, "code": string, "errors"?: { field: string[] } }` with the right HTTP status (422 validation, 401, 403, 404, 409 conflict such as stock, 429).
- Money is stored and transported as integer minor units (`*_cents`). Never use floats for money.
- Resources whitelist fields. Never return password hashes, tokens, Stripe secrets or internal flags.

## Security rules (non-negotiable)

- Prices, discounts, shipping and totals are computed on the backend only. Ignore any price or total the client sends.
- Coupons are re-validated (active, dates, usage limit, minimum order) at checkout and again when payment is finalized.
- Stock: checked at add-to-cart and checkout, and decremented only when an order becomes paid. That happens inside a DB transaction with `lockForUpdate()` on product rows. Cancelling a paid order restores stock.
- Payments use a manual-capture PaymentIntent: authorize, lock and decrement stock, then capture. If stock fails, cancel the intent so the customer is never charged.
- Every customer-owned resource query is scoped to the authenticated user (IDOR). Use `$request->user()->orders()`, never `Order::find($id)`.
- Permissions, not role names, protect admin routes (`permission:products.create`). Super Admin bypasses checks via `Gate::before` and cannot be edited or deleted.
- Login: generic failure message, throttled after 5 failed attempts per email+IP.
- Eloquent/Query Builder only; no raw SQL with interpolated input. Whitelist sort and filter columns.
- Never render user content as HTML (`dangerouslySetInnerHTML` is banned); Blade mails use `{{ }}`.
- Tokens live in httpOnly, SameSite=Lax cookies set by Next.js route handlers (BFF). Browser JS never sees a bearer token. Mutating BFF requests check `Origin`.

## Design

- Storefront follows the Figma "E-commerce Website Template": desktop 1440px, mobile 390px. Use the design tokens in `frontend/src/app/globals.css`; do not hardcode colors or fonts in components.
- The admin panel has no Figma design: Tailwind, sidebar layout, consistent with the shared components.
