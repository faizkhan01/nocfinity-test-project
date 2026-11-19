# SHOP.CO: e-commerce test project

A full-stack store built from the Figma *E-commerce Website Template* (SHOP.CO):

- **Storefront:** browse, filter, cart, Stripe checkout and order tracking.
- **Admin panel:** role-based access for the staff who run the store.

| Layer | Tech |
| --- | --- |
| API | Laravel 12 (PHP 8.4), Sanctum bearer tokens, MySQL 8, Stripe PHP SDK |
| Web | Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, TanStack Query, Stripe Elements |
| Infra | Docker Compose: php-fpm, nginx, MySQL, **Redis** (cache, queue, rate limits), **Meilisearch** (product search), queue worker, scheduler, Mailpit, Next.js |

## Live demo

| | URL |
| --- | --- |
| Storefront | https://nocfinity-shop.vercel.app |
| Admin panel | https://nocfinity-shop.vercel.app/admin |
| REST API | https://api-production-c1887df3.up.railway.app/api/v1 |
| Mailpit (demo inbox, password-protected) | https://mailpit-production-c1dd5411.up.railway.app |

The demo accounts below work on the live site too. Payments run in Stripe **test mode**, so use the test cards.

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

```bash
docker compose exec app php artisan test
```

There are 54 feature tests. They run against a separate MySQL database (`shop_testing`) with a fake payment gateway, and cover:
- **Checkout and money:** the full flow, ignoring client-sent prices and totals, overselling while a payment is in flight, declined cards, amount mismatches, idempotent capture, expired coupons and coupon usage limits under concurrency, and refunds with stock restored on cancel.
- **Access and security:** IDOR, login lockout, customer/admin guard separation, permission middleware, Super Admin protections and catalog filters.
- **Admin smoke test:** every admin read endpoint is rendered against the full seed data.

The frontend is type-checked and linted with `npm run lint` and `npx tsc --noEmit`, and `next build` runs both. The main flows were also run end to end in a real browser against Stripe test mode: guest cart merging into the account at login, card checkout and declines, admin product create/edit, order fulfilment emails, and permission matrix changes.

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
| Feature tests for checkout, stock and RBAC | ✅ |
| Guest cart merged on login | ✅ (server-side guest cart identified by an httpOnly cookie) |
| Product reviews and ratings | ✅ verified buyers only, with moderation |
| Email verification | ✅ signed link, resend from the account page |
| Activity log | ✅ |
| 2FA (TOTP) for admins | ✅ Set up from **Profile**: QR code, confirm a code, 8 single-use recovery codes. Login then needs the code, with replay protection and an attempt limit; staff managers can reset a colleague's 2FA. |
| Admin dark mode | ✅ Light / Dark / System toggle in the admin header, rendered on the server from a cookie so there is no flash. |
| Live deployment | ✅ Storefront on Vercel; API, queue worker, MySQL and a password-protected Mailpit on Railway (see [Deployment](#deployment)). |

## Deployment

The live demo runs on two platforms.

**Railway** (`nocfinity-shop` project):
- **`api`:** `backend/Dockerfile.production`. FrankenPHP on `$PORT`; caches config and routes, migrates, seeds an empty database and publishes the demo images on boot. A persistent volume is mounted at `/app/storage/app/public` for uploads.
- **`worker`:** the same image with `CONTAINER_ROLE=worker`. Runs `queue:work` (emails) and the scheduler (expiring unpaid orders, pruning guest carts).
- **`MySQL`:** Railway's managed MySQL, wired in with `DB_URL=${{MySQL.MYSQL_URL}}`.
- **`mailpit`:** the demo inbox, behind basic auth (`MP_UI_AUTH`).
- **`Redis`:** cache, queue and rate limits for the API and the worker (`REDIS_URL=${{Redis.REDIS_URL}}`).

Search runs on the built-in matcher (`SCOUT_DRIVER=database`), because Railway's free plan allows five services. It still finds partial words, typos and plurals. On a paid plan, add a Meilisearch service and set `SCOUT_DRIVER=meilisearch`, `MEILISEARCH_HOST` and `MEILISEARCH_KEY`; the API indexes the catalog on boot.

**Vercel** (`nocfinity-shop`): the Next.js app, with `API_URL` pointing at the Railway API. `/storage/*` is rewritten to the API, so images stay same-origin.

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
