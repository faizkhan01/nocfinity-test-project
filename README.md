# SHOP.CO: e-commerce test project

A full-stack store built from the Figma *E-commerce Website Template* (SHOP.CO):

- **Storefront:** browse, filter, cart, Stripe checkout and order tracking.
- **Admin panel:** role-based access for the staff who run the store.

| Layer | Tech |
| --- | --- |
| API | Laravel 12 (PHP 8.4), Sanctum bearer tokens, MySQL 8, Stripe PHP SDK |
| Web | Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, TanStack Query, Stripe Elements |
| Infra | Docker Compose: php-fpm, nginx, MySQL, **Redis** (cache, queue, rate limits), **Meilisearch** (product search), queue worker, scheduler, Mailpit, Next.js |
| Production services | **Cloudinary** (image storage and resizing CDN), **Brevo** (email to real inboxes) |

## Live demo

| | URL |
| --- | --- |
| Storefront | https://nocfinity-shop.vercel.app |
| Admin panel | https://nocfinity-shop.vercel.app/admin |
| REST API | https://api-production-c1887df3.up.railway.app/api/v1 |
| Mailpit (demo inbox for the seeded `.test` accounts, password-protected) | https://mailpit-production-c1dd5411.up.railway.app |

The demo accounts below work on the live site too. Payments run in Stripe **test mode**, so use the test cards. Emails to the demo accounts land in Mailpit; sign up with a real address to receive them in your own inbox.

More detail lives in two companion documents:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how totals, stock and RBAC are secured.
- [docs/API.md](docs/API.md): the API reference.

---

## Quick start (one command)

Requirements: Docker with Compose v2. No local PHP, Composer or Node.js is needed.

```bash
git clone https://github.com/faizkhan01/nocfinity-test-project.git
cd nocfinity-test-project

cp backend/.env.example backend/.env      # then add your Stripe test keys (see below)
docker compose up -d --build
```

The first boot installs Composer packages, generates the app key, runs migrations and seeds demo data. That takes about 2 minutes. `docker compose ps` shows `app` as **healthy** when it's ready.

| URL | What |
| --- | --- |
| http://localhost:3000 | Storefront |
| http://localhost:3000/admin | Admin panel |
| http://localhost:8000/api/v1 | REST API |
| http://localhost:8025 | Mailpit (every email the app sends: verification, password reset, order updates) |
| http://localhost:7700 | Meilisearch (search engine; master key in `docker-compose.yml`) |

To reset everything to fresh seed data:

```bash
docker compose exec app php artisan migrate:fresh --seed
```

### Running the frontend outside Docker (optional, for development)

```bash
docker compose up -d app nginx mysql mailpit queue scheduler
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

## Environment variables

`backend/.env` is the only file you need to edit. Everything else has working defaults.

| Variable | Purpose |
| --- | --- |
| `STRIPE_KEY` / `STRIPE_SECRET` | Stripe **test mode** keys from https://dashboard.stripe.com/test/apikeys. Required for checkout. |
| `STRIPE_WEBHOOK_SECRET` | Optional; only needed if you forward webhooks with the Stripe CLI (see below). |
| `APP_URL`, `FRONTEND_URL` | Public API and storefront origins (used for links in emails and CORS). |
| `DB_*` | MySQL connection. Compose overrides the host and port for containers. |
| `MAIL_*` | SMTP. Defaults point at Mailpit. |
| `SANCTUM_EXPIRATION` | Token lifetime in minutes (default 7 days). |
| `SHOP_SHIPPING_FLAT_CENTS`, `SHOP_FREE_SHIPPING_MIN_CENTS` | Delivery fee rules (default: flat $15). |
| `SHOP_PENDING_ORDER_TTL` | Minutes before an unpaid order is cancelled and its payment voided (default 60). |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | The seeded Super Admin account. |
| `TRUSTED_PROXIES` | Proxies allowed to set `X-Forwarded-*` (defaults to private ranges). |
| `BFF_SHARED_SECRET` | Shared with the Next.js server so the API believes the visitor IP it forwards (set the same value on both sides). |
| `CLIENT_IP_HEADER` | Behind an edge that overwrites a client-IP header (Railway: `X-Real-IP`), name it here. |
| `CACHE_STORE`, `QUEUE_CONNECTION`, `REDIS_*` | Redis for cache, queue and rate limits (defaults in `.env.example`). |
| `MAIL_MAILER`, `BREVO_API_KEY`, `MAIL_FROM_ADDRESS` | `smtp` sends everything to Mailpit (local default). `routed` (production) sends real inboxes through Brevo's HTTP API and demo addresses (`.test`, `example.com`) to Mailpit, so seeded accounts never bounce. The from address must be a sender verified in Brevo. |
| `MEDIA_DRIVER`, `CLOUDINARY_URL`, `CLOUDINARY_FOLDER` | `local` (public disk, the default) or `cloudinary` for product and category images on Cloudinary's CDN, resized per screen. `CLOUDINARY_URL` is `cloudinary://<api_key>:<api_secret>@<cloud_name>` from the Cloudinary console (free plan, no card). |
| `SCOUT_DRIVER`, `MEILISEARCH_*` | `meilisearch`, or `database` for the built-in matcher (no extra service). Both handle typos and partial words. |

The frontend reads only `API_URL` (where Laravel is reachable from the Next.js server) and, in Docker, `COOKIE_SECURE`.

## Demo accounts

Every account below is created by the seeders.

| Role | Email | Password | Can do |
| --- | --- | --- | --- |
| Super Admin | `superadmin@nocfinity-shop.test` | `SuperAdmin@123` | Everything, including roles and staff |
| Admin | `admin@nocfinity-shop.test` | `Staff@12345` | Everything except editing roles |
| Product Manager | `products@nocfinity-shop.test` | `Staff@12345` | Products, categories and reviews |
| Order Manager | `orders@nocfinity-shop.test` | `Staff@12345` | Orders, coupons, customers and reports |
| Support | `support@nocfinity-shop.test` | `Staff@12345` | Read-only orders, customers, products and coupons |
| Customer | `customer@nocfinity-shop.test` | `Customer@123` | Has delivered, shipped and cancelled orders, so can leave reviews |

You can also register a new customer. The welcome banner's 20% offer is the `WELCOME20` coupon.

### Seed data

- A two-level category tree (Men → T-shirts, Shirts, Polos, Jeans, Shorts; Unisex → Graphic Tees).
- 20 products using the product photography from the Figma file. One is sold out and one has 3 left.
- 96 orders in every status across the last 30 days, which feed the dashboard chart.
- 46 verified-buyer reviews that reproduce the ratings and testimonials shown in the design.

| Coupon | Rule |
| --- | --- |
| `WELCOME20` | 20% off, max $100 off, once per customer |
| `SAVE15` | $15 off orders of $100 or more, 500 uses |
| `FLASH50` | 50% off, first 5 orders only, expires in 2 days |
| `SUMMER10` | Expired: shows the "This coupon has expired" rejection |

## Stripe test cards

Use any future expiry date and any CVC.

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Declined: the order stays unpaid and you can retry |
| `4000 0000 0000 9995` | Declined: insufficient funds |
| `4000 0025 0000 3155` | Requires 3-D Secure authentication |

Payments are **authorized first and captured only after stock is secured**. If an item sells out while the customer is paying, the authorization is voided and nobody is charged ([details](docs/ARCHITECTURE.md#money-stock-and-payments)).

Webhooks are optional, because the browser confirmation already settles the order. To also process Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe
# put the printed whsec_... value in STRIPE_WEBHOOK_SECRET
```

## Tests

### Backend: 72 feature tests

```bash
docker compose exec app php artisan test
```

They run against a separate MySQL database (`shop_testing`) with a fake payment gateway, and cover:
- **Checkout and money:** the full flow, ignoring client-sent prices and totals, overselling while a payment is in flight, declined cards, amount mismatches, idempotent capture, expired coupons and coupon usage limits under concurrency, parallel checkouts, and refunds with stock restored on cancel.
- **Access and security:** IDOR, login lockout, rate limits, customer/admin guard separation, permission middleware, Super Admin protections and catalog filters.
- **Search:** partial words, typos, plurals, colours, categories and synonyms.
- **Images and email:** Cloudinary uploads (request signing, cleanup after a failed save, images kept for past orders, outages as 503, moving old images), and email (Brevo's API, routing demo addresses to Mailpit, every email queued after commit on the right queue).
- **Admin smoke test:** every admin read endpoint is rendered against the full seed data.

### Frontend: 83 unit tests (Vitest and Testing Library)

```bash
cd frontend
npm test                # or npm run test:coverage
```

They cover formatting, shop filter URLs, form validation and safe redirects, visitor IP headers, the API client, the route guards and CSP, the BFF proxy (CSRF, httpOnly token cookies, path checks), the Cloudinary image loader, and the search box, quantity stepper, price and pagination components. The logic layer must keep at least 90% line coverage.

### End to end: 31 Playwright tests

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build --wait
cd frontend && npx playwright install chromium
E2E_STRIPE=1 MAILPIT_URL=http://localhost:8025 npm run e2e
```

- **Storefront:** search as you type and typo tolerance, filters and sorting in the URL, guest cart, quantities, coupons, and a 404 for unknown products.
- **Accounts:** sign-in redirects, client-side validation, wrong passwords, open-redirect protection, the guest cart merging on sign-up, and httpOnly session cookies.
- **Checkout:** a declined card, then a real Stripe test-mode payment that ends as a paid order with a confirmation email in Mailpit.
- **Admin:** separate staff sessions, sign-in, permissions for the Support role (in the UI and the API), moving an order along its lifecycle, dark mode, and the protected Super Admin role.
- **Mobile:** key pages fit a phone screen, and the mobile search works.

Notes on running them:
- The e2e override raises the per-IP rate limits, because every request comes from one machine.
- The checkout specs need Stripe test keys in `backend/.env` and `E2E_STRIPE=1`; otherwise they are skipped.
- On failure, `frontend/playwright-report` has traces, screenshots and videos (`npx playwright show-report`).

## Feature checklist

**Storefront (from Figma, 1440px and 390px):** home, category listing with the filter panel (mobile bottom sheet), product detail with gallery, options and reviews, and cart with promo codes. Checkout, order confirmation, My Orders, order detail, auth pages and account use the same design language.

**Admin:**
- Dashboard (stat cards, 30-day sales chart, recent orders, low stock).
- Optional two-factor sign in (TOTP + recovery codes) and a light/dark/system theme.
- Products (multi-image, prices, discount, stock, SKU, category, active toggle).
- Two-level categories, and orders (filters, detail, status actions).
- Coupons, customers with order history, and the roles and permission matrix.
- Staff, review moderation, activity log, and profile.
- A sidebar that only shows what the signed-in staff member may use.

**Business rules:**
- Order lifecycle `pending → paid → processing → shipped → delivered` (+ `cancelled`), with a status history.
- Stock is taken only when an order is paid, under row locks, and restored on cancel.
- `ORD-YYYY-NNNNNN` order numbers, and an email on every status change.
- Unpaid orders expire.
- A guest cart merges into the customer's cart on login.

### Bonus items

| Bonus | Status |
| --- | --- |
| Docker one-command run | ✅ |
| Feature tests for checkout, stock and RBAC | ✅ plus frontend unit tests and Playwright end-to-end tests |
| Guest cart merged on login | ✅ (server-side guest cart identified by an httpOnly cookie) |
| Product reviews and ratings | ✅ verified buyers only, with moderation |
| Email verification | ✅ signed link, resend from the account page |
| Activity log | ✅ |
| 2FA (TOTP) for admins | ✅ Set up from **Profile**: QR code, confirm a code, 8 single-use recovery codes. Login then needs the code, with replay protection and an attempt limit; staff managers can reset a colleague's 2FA. |
| Admin dark mode | ✅ Light / Dark / System toggle in the admin header, rendered on the server from a cookie so there is no flash. |
| Image storage and resizing | ✅ Cloudinary (`MEDIA_DRIVER=cloudinary`): uploads go to its CDN and every image is served at the width the screen needs, as AVIF/WebP. |
| Live deployment | ✅ Storefront on Vercel; API, queue worker, MySQL and a password-protected Mailpit on Railway (see [Deployment](#deployment)). |

## Deployment

The live demo runs on two platforms.

**Railway** (`nocfinity-shop` project):
- **`api`:** `backend/Dockerfile.production`. FrankenPHP on `$PORT`. On boot it caches config and routes, migrates, seeds an empty database, and moves any image still on the volume (`/app/storage/app/public`) to Cloudinary.
- **`worker`:** the same image with `CONTAINER_ROLE=worker`. Runs `queue:work --queue=high,default` (emails, auth emails first, and search indexing) and the scheduler (expiring unpaid orders, pruning guest carts).
- **`MySQL`:** Railway's managed MySQL, wired in with `DB_URL=${{MySQL.MYSQL_URL}}`.
- **`mailpit`:** the demo inbox for the seeded `.test` accounts, behind basic auth (`MP_UI_AUTH`).
- **`Redis`:** cache, queue and rate limits for the API and the worker (`REDIS_URL=${{Redis.REDIS_URL}}`).

Images and email use two free external services, set on both `api` and `worker`:
- **Cloudinary:** `MEDIA_DRIVER=cloudinary`, `CLOUDINARY_URL`, `CLOUDINARY_FOLDER=nocfinity`.
- **Brevo:** `MAIL_MAILER=routed`, `BREVO_API_KEY`, and `MAIL_FROM_ADDRESS` set to a sender verified in Brevo.

Search runs on the built-in matcher (`SCOUT_DRIVER=database`), because Railway's free plan allows five services. It still finds partial words, typos and plurals. On a paid plan, add a Meilisearch service and set `SCOUT_DRIVER=meilisearch`, `MEILISEARCH_HOST` and `MEILISEARCH_KEY`; the API indexes the catalog on boot.

**Vercel** (`nocfinity-shop`): the Next.js app, with `API_URL` pointing at the Railway API. Cloudinary images load straight from its CDN; any image still on the API's disk is reached through the `/storage/*` rewrite, so it stays same-origin.

To redeploy after changes:

```bash
# API and worker (deploy a clean export so only committed files are uploaded)
git archive HEAD backend | tar -x -C /tmp/deploy
npx @railway/cli up /tmp/deploy/backend --path-as-root --service api
npx @railway/cli up /tmp/deploy/backend --path-as-root --service worker

# Frontend
cd frontend && npx vercel deploy --prod
```

Production trusts only Railway's internal proxy range (`TRUSTED_PROXIES=100.64.0.0/10`, `CLIENT_IP_HEADER=X-Real-IP`). Vercel and the API share `BFF_SHARED_SECRET`, so shopper IPs reach the rate limiter intact ([details](docs/ARCHITECTURE.md#visitor-ip-rate-limits-and-lockouts)).

## Design notes

- **Headings font:** the design uses *Integral CF*, a paid Fontfabric font with no redistribution licence. Headings use **Archivo Black**, a free font whose measured glyph widths match the design within a few pixels. *Satoshi* (body text) is free under the ITF Free Font License and is bundled.
- **Discount badges:** these show the real percentage. The design's badges (for example "-20%" on $260 → $240) don't match its own prices, and showing a wrong discount to customers would be misleading.
- **Images:** product photos come from the Figma file. A few products only appear in the design at 1x, so those images are 1x crops.
