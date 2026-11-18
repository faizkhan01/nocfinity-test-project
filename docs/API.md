# API reference

- **Base URL:** `http://localhost:8000/api/v1`. All requests and responses are JSON (`Accept: application/json`).
- **Auth:** Laravel Sanctum bearer tokens (`Authorization: Bearer <token>`). Customer and staff tokens come from separate login endpoints and only work on their own routes.
- **Money:** every amount is an **integer in cents** (`price_cents: 12000` = $120.00).

## Conventions

**Success**: an API Resource, with pagination metadata on every list:

```json
{
  "data": [ { "id": 1, "name": "T-shirt with Tape Details", "final_price_cents": 12000 } ],
  "links": { "first": "…?page=1", "last": "…?page=3", "prev": null, "next": "…?page=2" },
  "meta": { "current_page": 1, "last_page": 3, "per_page": 9, "total": 20, "from": 1, "to": 9 }
}
```

**Error**: always `message` and a machine-readable `code`, plus `errors` for field problems:

```json
{ "message": "Only 3 of this product left in stock.", "code": "insufficient_stock", "errors": { "quantity": ["Only 3 left in stock."] } }
```

| Status | When | Example `code` |
| --- | --- | --- |
| 401 | Missing or expired token | `unauthenticated` |
| 402 | Card declined | `payment_failed` |
| 403 | Missing permission, protected record, disabled account | `forbidden`, `protected_role`, `account_disabled` |
| 404 | Not found, or not yours | `not_found` |
| 409 | Business conflict | `insufficient_stock`, `payment_mismatch`, `role_in_use`, `category_has_products` |
| 422 | Validation or rule failure | `validation_error`, `coupon_invalid`, `invalid_transition`, `invalid_options` |
| 429 | Rate limit or login lockout | `too_many_requests`, `too_many_attempts` |
| 502 | Payment provider unreachable | `payment_provider_error` |

## Customer authentication

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | `name, email, password, password_confirmation` → `{ token, expires_at, user }`. Sends a verification email. Merges the guest cart from `X-Cart-Token`. |
| POST | `/auth/login` | `email, password` → token. Generic failure message; locked for 5 minutes after 5 failures per email+IP. |
| POST | `/auth/logout` | Revokes the current token. |
| GET | `/auth/me` | Current customer. |
| PUT | `/auth/profile` | `name, phone` |
| PUT | `/auth/password` | `current_password, password, password_confirmation`. Revokes your other tokens. |
| POST | `/auth/forgot-password` | `email`. Same response whether or not the account exists. |
| POST | `/auth/reset-password` | `token, email, password, password_confirmation` |
| GET | `/auth/email/verify/{id}/{hash}` | Signed link from the verification email; redirects to the storefront. |
| POST | `/auth/email/resend` | Resends the verification link. |

## Catalog (public)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/categories` | Active two-level tree. |
| GET | `/products` | Listing; query parameters below. |
| GET | `/products/filters` | Facets for the filter panel: colours, sizes, styles, price range. |
| GET | `/products/{slug}` | Detail: images, colours, sizes, stock, `stock_status`, category with parent. |
| GET | `/products/{slug}/related` | Up to 4 products from the same category. |
| GET | `/products/{slug}/reviews` | `sort=latest\|highest\|lowest`, 6 per page. |
| POST | `/products/{slug}/reviews` | Customer only: `rating` (1–5) and `comment`. Only after a delivered order containing the product, once per product. |
| GET | `/reviews/featured` | Recent high-rated reviews for the home page. |
| POST | `/newsletter` | `email`. Idempotent. |

`GET /products` query parameters:

| Parameter | Example | Notes |
| --- | --- | --- |
| `search` | `jeans` | Name, short description or SKU. Wildcards are literal. |
| `category` | `men` | Category slug; a parent includes its subcategories. |
| `min_price`, `max_price` | `5000`, `20000` | Cents, applied to the discounted price. |
| `colors`, `sizes`, `styles` | `Red,Blue` or `colors[]=Red` | Any of the listed values. |
| `in_stock`, `on_sale`, `featured` | `1` | Boolean filters. |
| `sort` | `newest` (default), `popular`, `price_asc`, `price_desc`, `rating` | Whitelisted. |
| `page`, `per_page` | `2`, `9` | `per_page` is 1–48. |

## Cart (guest or customer)

A guest cart is identified by the `X-Cart-Token` header; its value is returned as `data.token` the first time an item is added. A signed-in customer's bearer token selects their own cart instead. Every endpoint returns the full server-priced cart:

```json
{ "data": { "token": null, "items": [ { "id": 7, "product": { "id": 3, "name": "Checkered Shirt", "slug": "checkered-shirt", "image": "…", "stock": 25 },
  "color": "Red", "size": "Medium", "quantity": 1, "unit_price_cents": 18000, "original_price_cents": 18000, "line_total_cents": 18000, "issue": null } ],
  "coupon": { "code": "WELCOME20", "type": "percentage", "value": 20, "error": null },
  "item_count": 1, "subtotal_cents": 18000, "discount_cents": 3600, "shipping_cents": 1500, "total_cents": 15900, "currency": "usd", "has_issues": false } }
```

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/cart` | |
| POST | `/cart/items` | `product_id, quantity, color, size`. Options must belong to the product; stock-checked (409 `insufficient_stock`); max 20 per line. |
| PATCH | `/cart/items/{id}` | `quantity` |
| DELETE | `/cart/items/{id}` | |
| POST | `/cart/coupon` | `code`. 422 `coupon_invalid` with the specific reason (expired, minimum order, limit reached…). |
| DELETE | `/cart/coupon` | |

## Checkout and orders (customer)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/checkout` | `shipping { name, phone, line1, line2?, city, state?, postal_code, country }`, `notes?`. Prices the cart on the server and creates a `pending` order → `{ order, payment: { client_secret, publishable_key } }`. Any price or total in the body is ignored. |
| POST | `/orders/{number}/confirm-payment` | After Stripe.js confirms the card. The server checks the intent with Stripe, locks stock, captures, and returns the `paid` order. 402 on decline, 409 if stock ran out (authorization voided). |
| GET | `/orders/{number}/payment-intent` | `client_secret`, to retry payment on a pending order. |
| GET | `/orders` | Your orders; `status` filter, 10 per page. |
| GET | `/orders/{number}` | Detail with items, totals, payment, status history. Another customer's order is 404. |
| POST | `/orders/{number}/cancel` | While `pending` or `paid`. Refunds and restores stock. |
| POST | `/webhooks/stripe` | Stripe signature-verified; `payment_intent.*` events. |

## Admin (staff token; each route needs the listed permission)

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/admin/auth/login`, `/admin/auth/forgot-password`, `/admin/auth/reset-password` | none |
| GET/POST | `/admin/auth/me` (includes effective `permissions`), `/admin/auth/logout` | any staff |
| PUT | `/admin/profile`, `/admin/profile/password` | any staff |
| GET | `/admin/dashboard` | `dashboard.view` (revenue and chart need `reports.view`; recent orders need `orders.view`) |
| GET | `/admin/products`: `search, category_id, status, stock=low\|out, sort, per_page` | `products.view` |
| GET | `/admin/products/{id}` | `products.view` |
| POST | `/admin/products` (multipart: fields, `images[]`, `colors[i][name\|hex]`, `sizes[]`) | `products.create` |
| PUT | `/admin/products/{id}` (multipart via `_method=PUT`, plus `remove_image_ids[]`) | `products.edit` |
| PATCH | `/admin/products/{id}/status`: `is_active` | `products.edit` |
| DELETE | `/admin/products/{id}` (soft delete) | `products.delete` |
| GET | `/admin/categories` | `categories.view` or `products.view` |
| POST/PUT/DELETE | `/admin/categories[/{id}]`. Max two levels; deleting a category that has children or products returns 409. | `categories.manage` |
| GET | `/admin/orders`: `status, search, customer_id, date_from, date_to` | `orders.view` |
| GET | `/admin/orders/{id}` (includes `allowed_transitions`) | `orders.view` |
| PATCH | `/admin/orders/{id}/status`: `status, note?`. Cancelling refunds and restocks; `paid` can't be set by hand. | `orders.update_status` |
| GET | `/admin/coupons`: `search, status=active\|inactive\|expired` | `coupons.view` |
| POST/PUT/DELETE | `/admin/coupons[/{id}]` | `coupons.manage` |
| GET | `/admin/customers`, `/admin/customers/{id}` (with order history) | `customers.view` |
| GET/PATCH/DELETE | `/admin/reviews[/{id}]` | `reviews.manage` |
| GET | `/admin/permissions` (grouped), `/admin/roles` | `roles.view` (roles list also with `staff.view`) |
| POST/PUT/DELETE | `/admin/roles[/{id}]`: `name, description, permissions[]`. Super Admin role is protected; built-in roles can't be deleted. | `roles.manage` |
| GET | `/admin/staff`, `/admin/staff/{id}` | `staff.view` |
| POST/PUT/DELETE | `/admin/staff[/{id}]`: `name, email, password, is_active, roles[]` | `staff.manage` |
| GET | `/admin/activity-logs` | `activity_logs.view` |

## Example: guest to paid order with curl

```bash
API=http://localhost:8000/api/v1; H='Content-Type: application/json'

# 1. Add to a guest cart; keep the returned token.
CART=$(curl -s -H "$H" -X POST $API/cart/items -d '{"product_id":1,"quantity":1,"color":"Black","size":"Large"}' | jq -r .data.token)

# 2. Log in with the cart token so the guest cart is merged.
TOKEN=$(curl -s -H "$H" -H "X-Cart-Token: $CART" -X POST $API/auth/login \
  -d '{"email":"customer@nocfinity-shop.test","password":"Customer@123"}' | jq -r .data.token)

# 3. Check out: returns the order and a Stripe client_secret for Stripe.js.
curl -s -H "$H" -H "Authorization: Bearer $TOKEN" -X POST $API/checkout \
  -d '{"shipping":{"name":"Jane","phone":"+1 555 0100","line1":"1 Main St","city":"Austin","postal_code":"73301","country":"US"}}'
```
