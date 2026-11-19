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

## Two-factor authentication (staff)

- **Setup:** from the admin profile, with the password confirmed first. The server generates a TOTP secret and renders the QR code itself, so the secret never goes to a third-party QR service. Confirming a code turns 2FA on and returns 8 recovery codes once; they are stored as SHA-256 hashes.
- **Login:** a correct password returns a random, single-use **challenge** (cached for 5 minutes, max 5 wrong codes), never a token. The token is issued only after a valid TOTP code (±1 time step for clock drift) or an unused recovery code.
- **Replay protection:** the last accepted time step is stored, so the same code can't be used twice.
- **Changes:** disabling 2FA or regenerating codes needs the password. A staff manager can reset a colleague's 2FA (lost phone); that also revokes all of their tokens.

## Admin theme

- **Dark mode** works by re-pointing the design tokens (`--color-white`, `--color-ink`, `--color-surface`…) under `[data-theme="dark"]`, so every token-based utility switches at once. A `dark:` variant covers the few fixed colours, such as status badges.
- **Preference:** stored in a cookie and applied by the server-rendered layout, so there's no flash on load. "System" follows `prefers-color-scheme`.
- **Storefront:** never sets `data-theme`, so it's unaffected.

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
3. The browser confirms the card with Stripe Elements, then calls `POST /orders/{number}/confirm-payment`. The Stripe webhook and the reconciliation job (below) call the same idempotent code.
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

Staff can never set `paid` by hand. Cancelling a paid order restores stock (under the same locks), gives back the coupon use and refunds the payment; cancelling a pending one voids the authorization. Every change writes `order_status_histories` and queues an email. `payments:reconcile` settles what the browser and webhooks did not (see below).

### Webhooks and reconciliation

Three paths can settle a payment: the browser's confirmation, a Stripe webhook, and a scheduled reconciliation. All three call the same idempotent `finalize`, which re-reads the intent from Stripe and locks the order row, so whichever arrives first wins and the others change nothing.

- **Webhook events are recorded** in `stripe_events` by Stripe's event ID, with the type, the payment intent, the number of attempts and the outcome (`finalized`, `failure_recorded`, `cancelled`, `ignored`, or `rejected:<code>`).
  - A redelivered event is answered `duplicate` and not processed again.
  - Two deliveries arriving together cannot both run: each one has to claim the row with a single conditional update first.
  - If processing crashes, the claim is released and the API answers 500, so Stripe retries. A claim left behind by a process that died expires after 5 minutes.
  - Business outcomes such as "sold out" are final and answered 200, so Stripe does not retry them.
  - Processed events are pruned after 30 days (`model:prune`).
- **Reconciliation** (`payments:reconcile`, every 5 minutes) checks each order that has been pending for more than `SHOP_RECONCILE_AFTER_MINUTES` (5) against Stripe. This covers a customer who closes the browser right after paying while webhooks are off or delayed:
  - **Authorized or captured:** finalized as usual. Stock is locked and taken, the payment is captured and the confirmation email is sent. If the stock sold out meanwhile, the order is cancelled and the authorization voided.
  - **Cancelled at Stripe:** the order is cancelled.
  - **Unpaid:** left alone until `SHOP_PENDING_ORDER_TTL` (60 minutes), then cancelled and voided. A payment Stripe is still processing is never voided.
  - An authorized payment is never voided by expiry, which the previous expiry job did.
  - One order failing (e.g. a Stripe timeout) does not stop the others. It is reported and retried on the next run.

**Order numbers** are `ORD-{year}-{id padded to 6}`. They're derived from the auto-increment ID, so they're unique without a separate counter.

## Search

- **Engine:** Laravel Scout indexes active products in **Meilisearch** (typo-tolerant: "jens" finds jeans, "chekered shrt" finds Checkered Shirt). Name, SKU, category, colours, style and descriptions are indexed, in that order of weight.
- **Filters stay in MySQL:** the engine only returns matching IDs in relevance order. Price, colour, size, stock, visibility and category filters are then applied in MySQL, which stays the source of truth, so a stale index can never show a hidden or deleted product.
- **Indexing:** runs through the Redis queue, and only when a searchable field changes. A stock change from an order doesn't re-index.
- **Sorting:** searches sort by relevance ("Best Match") unless the shopper picks another order.
- **SKUs:** an exact SKU (`SC-0009`) is a direct database lookup, not a fuzzy search.
- **Without Meilisearch** (`SCOUT_DRIVER=database`, which production uses on the Railway free plan), a built-in matcher (`ProductMatcher`) is just as forgiving:
  - It matches whole words, prefixes while typing ("shir"), singular and plural ("jean"), joined or hyphenated forms ("tshirt", "t-shirt"), and typos ("shrit", "poloo", "skiny"). As a last resort it also matches words that sound alike ("grafic").
  - Typos are only tried when no word starts with the query, so "shirt" never brings up shorts.
  - It searches the name, SKU, colours, category (including the parent, e.g. "men shirt"), style and short description, plus a few synonyms from `config/shop.php` ("tee" = t-shirt).
  - Products matching every query word come first. If none match all of them, the closest partial matches are shown instead of an empty page.
  - The term index lives in Redis and is rebuilt when a searchable product or category field changes. A search takes about 1 ms on the seeded catalog. Past tens of thousands of products, switch to Meilisearch.
- **Fallback:** if Meilisearch is unreachable, search uses the built-in matcher instead of failing.

## Images

- **Storage:** `MediaStorage` saves uploads on the public disk or, with `MEDIA_DRIVER=cloudinary`, on Cloudinary through signed Upload API calls. Originals are capped at 2000px on upload.
- **References:** a stored value is either a disk path (`products/abc.jpg`) or `cloudinary:v<version>/<public_id>`. Both kinds resolve to URLs side by side, so switching drivers never breaks existing images, and `php artisan app:move-media-to-cloudinary` moves the old ones over (idempotent, with `--dry-run`).
- **Resizing:** the API returns a Cloudinary URL with automatic format and quality. The frontend's `MediaImage` adds a width-limited resize per `srcset` entry, so a 48px search thumbnail and a 444px gallery image are both served at their own size from the CDN. Local uploads still use the Next.js optimizer.
- **Zoom:** hovering the main product photo magnifies the spot under the mouse. A sharper copy (about 2.2 times the displayed width) is fetched only on the first hover; touch and keyboard users keep the plain photo.
- **Consistency:**
  - Deletes run only after the database transaction commits, and uploads from a save that fails are removed again.
  - An image that a past order shows is kept when it is removed from the product.
  - If Cloudinary is unreachable, the save fails with a 503 and nothing is half saved.

## Email

- **Always queued:** every email (verification, password reset, order updates) is a queued job, dispatched only after the database transaction commits, and sent by the worker. A slow or failing provider never slows a request or loses an email.
  - Auth emails go on a `high` queue that the worker (`--queue=high,default`) always drains first, so a reset link is not stuck behind order emails or search indexing.
  - `queue:work` exits cleanly every hour (`--max-time`), and hosts such as Railway only restart a container that fails. The worker script therefore keeps both `queue:work` and `schedule:work` running, restarting either one if it stops, and stops both cleanly on shutdown.
  - A job that uses up its retries is logged as critical and recorded in the admin **Activity log** (as "System", action `queue.job_failed`) with the job, queue and error, so a failing email provider is noticed instead of piling up silently in `failed_jobs`.
  - Each email is retried 5 times, backing off over about 20 minutes, and ends in `failed_jobs` if the provider is still down.
- **Transport:** production uses Brevo's HTTP API, because hosts like Railway's free plan block outbound SMTP.
- **Routing:** the `routed` mailer sends each recipient to the right place. Real inboxes go through Brevo. Placeholder addresses (the demo accounts on `.test`, and the reserved example domains) go to Mailpit, so the demo inbox keeps working and nothing bounces off Brevo's reputation.

## Redis

- **Queue:** emails and search indexing, with auth emails on a `high` queue that is always drained first.
- **Cache:** the storefront category tree, the filter facets and the built-in search's term index. They are flushed by model events when a category, or a product's facet or search fields, change; a stock change doesn't flush them.
- **Rate limits and lockouts:** login lockouts, 2FA challenges and the API, auth and checkout limits all count in Redis using atomic increments.
- **Databases:** Laravel keeps the queue in Redis database 0 and the cache in database 1.

## Visitor IP (rate limits and lockouts)

Rate limits and login lockouts are keyed by IP, so the API must see the real visitor and not a proxy. There are two cases:

- **Through the Next.js BFF** (all shopper traffic):
  - The BFF sends the visitor's IP in `X-Client-IP`, together with `X-BFF-Secret`, a secret only the Next.js server and the API know.
  - The API believes `X-Client-IP` only when the secret matches.
  - Without this, every shopper would appear as one of Vercel's few server IPs and share a single login limit.
- **Direct API calls behind Railway:** the API uses `X-Real-IP`, which Railway's edge overwrites with the connecting address. It's trusted only when the request comes from Railway's internal proxy range (`TRUSTED_PROXIES=100.64.0.0/10`).

Forged headers without the secret are ignored, so a client can't rotate fake IPs to escape a lockout. Tests cover all three cases.

Replacing `REMOTE_ADDR` with the visitor's IP means the proxy's `X-Forwarded-Proto` and `Host` would stop being trusted, so the middleware keeps the scheme and host the proxy reported. Without that, the API saw plain `http` behind Railway's TLS edge, and email links signed by the worker (with the `https` `APP_URL`) failed with "Invalid signature". Regression tests cover both.

Trusted proxies are read from config **at request time**. An earlier version read `env()` while handling requests, and once config was cached in production that silently returned the defaults, so the lockout never triggered. A regression test now covers it.

## Other security measures

- **IDOR:** customer order routes resolve through `$request->user()->orders()`, so another customer's order number is a 404. The same applies to cart item IDs.
- **SQL injection:** Eloquent and the query builder only. Sorts and filters are whitelisted, and `LIKE` input has its wildcards escaped.
- **XSS:**
  - All user content is rendered as text by React. There's no `dangerouslySetInnerHTML`, and Blade emails use `{{ }}`.
  - Product image uploads are restricted to JPG, PNG and WebP (no SVG), checked for type, size and dimensions, and stored under random names.
- **Headers:**
  - **Laravel:** `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, `Content-Security-Policy: default-src 'none'` on JSON responses, and HSTS over HTTPS.
  - **Next.js:** a per-request nonce-based CSP allowing only Stripe as a third party (and Cloudinary for images), plus the same frame, sniffing and referrer headers.
- **Responses** are whitelisted API Resources: no password hashes, tokens, Stripe secrets or internal flags. Production errors are generic, and model class names never leak through 404s.
- **Open redirects:** `?next=` only accepts same-site paths.
- **Rate limits:** auth routes (10/min), checkout (10/min) and the API overall (120/min) are rate-limited per visitor IP (see above).
- **Lost 2FA:** `php artisan app:reset-two-factor <email>` is a server-side break-glass for staff (including a Super Admin) who lose both their authenticator and recovery codes. On hosts without a shell, `RESET_TWO_FACTOR_FOR=<email>` runs it once at boot; remove it afterwards.

## What I would improve with more time

- **Re-authentication** prompt for sensitive admin actions, and optionally *requiring* 2FA for selected roles.
- **Product variants:** stock per colour and size instead of per product. The design's selectors suggest it; the brief asked for product-level stock.
- **Infrastructure:**
  - Meilisearch in production too (it needs a paid Railway plan; the code switches with `SCOUT_DRIVER`).
- **CI:** run the backend, unit and end-to-end suites on every push (they run locally today), plus Larastan once it is tuned.
- **Accessibility:** a full audit, and a dark theme for the storefront (the admin has one).
