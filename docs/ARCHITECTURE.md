# Architecture notes

## Repository layout

```
backend/            Laravel 12 REST API
  app/Enums/          OrderStatus (with its allowed transitions), CouponType, PaymentStatus, UserType
  app/Models/         User (shared table) → Customer / Staff, catalog, cart, order, payment, RBAC models
  app/Services/       Business rules: Auth, Catalog, Checkout (cart, pricing, coupons), Orders (checkout,
                      payment, stock, lifecycle), Payments (gateway interface, Stripe + fake), Admin
  app/Http/           Thin controllers (Storefront, Admin, Auth, Webhooks), FormRequests, API Resources,
                      middleware (permission, active account, security headers)
  database/           Migrations, factories, seeders and the seed product images
  tests/Feature/      Checkout/stock/payment, auth, RBAC, catalog and admin smoke tests
frontend/           Next.js 15 App Router
  src/app/(shop)/     Storefront routes (server components fetch the API directly)
  src/app/admin/      (auth) login/reset and (panel) admin routes behind a permission-aware layout
  src/app/bff/        Same-origin proxy to the API that owns the auth cookies
  src/components/     shop/, admin/, ui/ (shared primitives), icons exported from Figma
  src/lib/            API clients (server/browser), types, validation, formatting
docker-compose.yml  Whole stack
```

Controllers validate input with a FormRequest, call a service and return an API Resource. Business rules live in `app/Services`, which keeps them testable and in one place.

## Authentication and the BFF

- **Two guards over one table.** `users` holds customers and staff. `Customer` and `Staff` are scoped models with their own Sanctum guards (`auth:customer`, `auth:admin`). A token only authenticates against the guard of the model that owns it, so a customer token gets 401 on every admin route and vice versa.
- **Login hardening:**
  - The failure message is the same whether the email or the password was wrong, and a bcrypt check runs even for unknown emails, so response timing doesn't reveal which accounts exist.
  - Login locks for 5 minutes after 5 failures per email+IP, with an IP-wide limit on auth routes on top.
  - The password policy is 8+ characters with mixed case, a number and a symbol. In production it also checks the password against the Have I Been Pwned breach list.
  - A password reset or change revokes the user's other tokens.
- **Tokens never reach browser JavaScript.**
  - Next.js route handlers under `/bff/*` proxy the API. On login they move the bearer token into an `httpOnly`, `SameSite=Lax` cookie and strip it from the response body.
  - Server components read the same cookie to call the API.
  - The guest cart token is handled the same way.
- **CSRF.** Mutating `/bff` requests must carry an `Origin` matching the host, on top of `SameSite=Lax` cookies. The Laravel API itself is stateless (bearer tokens only), so it needs no CSRF tokens.

## Role-based access control

- **Schema:**
  - `roles`, `permissions`, and the `permission_role` and `role_user` pivots.
  - Permission names (`products.create`, `orders.update_status`, `reports.view` and so on) come from a single registry, `App\Support\PermissionRegistry`, which also seeds the database.
- **Routes are protected by permission, not role name:** `->middleware('permission:orders.update_status')`. The middleware runs before route-model binding, so an unauthorized user gets 403 rather than learning whether a record exists.
- **Super Admin:**
  - Holds every permission through `Gate::before`.
  - The role can't be edited or deleted, Super Admin accounts can't be edited or deleted by others, staff can't edit themselves through staff management, and only a Super Admin can grant the Super Admin role.
- **Admin UI:**
  - The admin layout loads the signed-in staff member's effective permissions from `/admin/auth/me`.
  - The sidebar, buttons and pages are filtered on them, but that's for convenience only: every request is authorized again by the API.
  - Deactivating a staff member revokes their tokens immediately.
- **Audit:** every admin write is recorded in `activity_logs` with the actor and IP.

## Money, stock and payments

**Money** is integer cents everywhere (`*_cents`), with no floats. A generated, indexed `effective_price_cents` column (`COALESCE(discount, price)`) makes price sorting and filtering correct for discounted products.

**Totals are only ever computed by the backend.** `PricingService` turns a cart into a `Quote`: unit prices from the database, the coupon discount, shipping and the total. The cart, checkout and the PaymentIntent amount all use that quote. Any `price`, `total` or `discount` field the client sends is ignored, and a test asserts it.

**Coupons are validated three times:**
1. When applied to the cart.
2. At checkout.
3. When the payment is finalized: the coupon row is locked and its usage counter only incremented then.

Each check covers active state, start and end dates, the total usage limit, the per-customer limit and the minimum order. An expired or exhausted coupon is rejected with a specific message.

**Order and payment flow (no overselling, never charging for stock we don't have):**

1. **Checkout:** the cart is re-priced and re-checked. Any unavailable item stops checkout with a per-item message. A `pending` order is created with item snapshots (name, SKU, image, unit price), so later catalog edits never change past orders. The customer's previous unpaid checkout is voided.
2. A card-only PaymentIntent is created with **`capture_method=manual`**: the card is authorized, not charged.
3. The browser confirms the card with Stripe Elements, then calls `POST /orders/{number}/confirm-payment`. The Stripe webhook calls the same idempotent code.
4. `PaymentService::finalize` **reads the intent from Stripe itself** and never trusts the client. It checks that the status is authorized, the amount, currency and order ID match, and the payment method is a card.
5. Inside one DB transaction, for the order (row locked, skipped if no longer pending):
   - Product rows are locked with `SELECT … FOR UPDATE`, in ID order to avoid deadlocks.
   - Stock is checked again, then decremented.
   - The coupon is locked and redeemed.
   - The PaymentIntent is captured, while the locks are still held.
   - The order is marked `paid`.
6. If stock ran out or the coupon became invalid, the transaction rolls back, **the authorization is cancelled (the customer is never charged)**, the order is cancelled with a clear reason, and the API returns 409. If capture fails, everything rolls back too.
7. After a successful payment, the purchased lines are removed from the cart and a confirmation email is queued.

**Lifecycle.** `OrderStatus` defines the allowed transitions:
- `pending → paid | cancelled`
- `paid → processing | cancelled`
- `processing → shipped | cancelled`
- `shipped → delivered`

Staff can never set `paid` by hand. Cancelling a paid order restores stock (under the same locks), gives back the coupon use and refunds the payment; cancelling a pending one voids the authorization. Every change writes `order_status_histories` and queues an email. A scheduled job expires unpaid orders after `SHOP_PENDING_ORDER_TTL` minutes.

**Order numbers** are `ORD-{year}-{id padded to 6}`. They're derived from the auto-increment ID, so they're unique without a separate counter.

## Other security measures

- **IDOR:** customer order routes resolve through `$request->user()->orders()`, so another customer's order number is a 404. The same applies to cart item IDs.
- **SQL injection:** Eloquent and the query builder only. Sorts and filters are whitelisted, and `LIKE` input has its wildcards escaped.
- **XSS:**
  - All user content is rendered as text by React. There's no `dangerouslySetInnerHTML`, and Blade emails use `{{ }}`.
  - Product image uploads are restricted to JPG, PNG and WebP (no SVG), checked for type, size and dimensions, and stored under random names.
- **Headers:**
  - **Laravel:** `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, `Content-Security-Policy: default-src 'none'` on JSON responses, and HSTS over HTTPS.
  - **Next.js:** a per-request nonce-based CSP allowing only Stripe as a third party, plus the same frame, sniffing and referrer headers.
- **Responses** are whitelisted API Resources: no password hashes, tokens, Stripe secrets or internal flags. Production errors are generic, and model class names never leak through 404s.
- **Open redirects:** `?next=` only accepts same-site paths.
- **Rate limits:** auth routes, checkout and the API overall are rate-limited. The proxy's forwarded client IP is used, but only from trusted proxies.

## What I would improve with more time

- **2FA (TOTP) for staff,** using the columns that already exist, plus a re-authentication prompt for sensitive admin actions.
- **Product variants:** stock per colour and size instead of per product. The design's selectors suggest it; the brief asked for product-level stock.
- **Infrastructure:**
  - Redis for cache, queue and rate limiting.
  - Object storage (S3) for uploads, with image resizing.
  - Full-text or Meilisearch product search.
- **Webhook event table:** record processed Stripe event IDs, and add a reconciliation job for intents authorized but never finalized (for example if the browser closes and webhooks are off).
- **Tests and CI:**
  - Frontend unit tests, and Playwright end-to-end tests in CI (the flows were run manually here).
  - Static analysis (Larastan is installed but not yet tuned) and a CI pipeline.
- **Accessibility:** an audit, and an admin dark mode.
