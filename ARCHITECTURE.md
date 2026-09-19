# Architecture

This document explains the technical decisions behind the project — the reasoning behind each design choice, not just a description of what exists.

## System Overview

```
┌─────────────┐        HTTPS/REST        ┌──────────────────┐        SQL        ┌────────────┐
│  Frontend    │ ───────────────────────▶ │   NestJS API      │ ────────────────▶ │ PostgreSQL │
│  (Next.js)   │ ◀─────────────────────── │   (Backend)        │ ◀──────────────── │            │
└─────────────┘         JSON              └──────────────────┘                    └────────────┘
                                                    │
                                                    │ Webhook (payment_intent.succeeded)
                                                    ▼
                                            ┌──────────────┐
                                            │    Stripe     │
                                            └──────────────┘
```

The backend is an independent REST API rather than a server-side monolith fused with the frontend. Next.js consumes it over HTTP exactly as any other client would (a mobile app, a separate admin panel, etc.), which allows additional clients to be added later without backend changes.

## Technology Choices

- **NestJS over raw Express**: a project of this size (12 modules) becomes disorganized quickly without an enforced structure (Module/Controller/Service with dependency injection).
- **Prisma over TypeORM**: stronger type safety, a clearer migration workflow, and a query builder that surfaces errors at compile time rather than runtime.
- **PostgreSQL**: native array support (the `images` field), robust transactions (required for order/inventory logic), and `ILIKE` for case-insensitive search without an additional extension.
- **UUIDs over auto-increment IDs**: avoids leaking record counts (e.g. total order volume) through URLs, and simplifies merging across distributed systems in the future.
- **Decimal instead of Float for prices**: floating-point arithmetic introduces rounding errors (e.g. 0.1 + 0.2 !== 0.3); monetary values require an exact type.

## Data Model

```
User ──┬── Address[]
       ├── Cart ── CartItem[] ── Product
       └── Order[] ──┬── OrderItem[] ── Product
                      ├── Coupon (optional)
                      └── Payment (1:1)

Category ── Product[] ── Inventory (1:1) ── StockMovement[]
```

`Cart` and `Order` both reference `Product`, but `OrderItem.unitPrice` is stored independently of `Product.price` by design — if a product's price changes later, historical orders retain their original price. Referencing only `productId` and computing price at read time is a common design mistake this avoids.

## Authentication — Access and Refresh Tokens

- **Access token** (15 minutes, signed with `JWT_ACCESS_SECRET`): used on every API request. Short-lived to limit exposure if leaked.
- **Refresh token** (7 days, signed with a separate secret): used only to obtain a new access token. Each token carries an `sid` claim pointing to a row in the `Session` table rather than a single field on `User`, so each device/browser maintains an independent session and a new login does not invalidate existing sessions. A hashed version of the refresh token is stored on the corresponding `Session` row and rotates on every refresh, so a stolen refresh token becomes invalid after the legitimate owner's next use.
- Roles (`Role`: CUSTOMER, STAFF, ADMIN) are embedded in the token payload, allowing `RolesGuard` to authorize without an additional database query.
- Session management endpoints: `GET /auth/sessions` (active devices, with user-agent/IP), `DELETE /auth/sessions/:id` (revoke one device), `POST /auth/logout-all` (revoke all sessions, e.g. after a password change). Revocation is soft (`revokedAt` is set rather than the row deleted), consistent with the soft-delete pattern used elsewhere in the schema.

## Order Lifecycle

```
PENDING → PAID → PROCESSING → SHIPPED → DELIVERED
   │                                        
   └──────────────→ CANCELLED / REFUNDED
```

A key design point is the **inventory reservation pattern**: when an order is created from the cart, stock is not decremented immediately. Instead, `Inventory.reserved` is incremented, and actual stock (`quantity`) is only decremented once payment is confirmed via webhook (`markOrderPaid` in `PaymentsService`). This avoids a common e-commerce failure mode: an unpaid or abandoned order does not permanently lock stock away from other customers, while stock is also never decremented prematurely, before payment is confirmed.

"Actually available" stock is always:
```
available = quantity - reserved
```

## Coupon Validation

Coupon validation logic is intentionally duplicated: once independently in `CouponsService.validate()` (a public endpoint for computing a discount without creating an order), and once inside `OrdersService.createFromCart()` at order-creation time. Order creation must validate independently and atomically rather than trusting a prior call, since a coupon could expire or reach its usage limit between the two. The check order is deliberate — active → not expired → usage limit → minimum order amount — followed by the discount calculation, which respects `maxDiscountAmount` to prevent disproportionate discounts on large orders when a percentage-based coupon is applied.

Current limitation: `CheckoutForm.tsx` submits the coupon code directly with `POST /orders` and only learns whether it is valid after the order-creation attempt (surfacing an error if invalid). `/coupons/validate` exists to support a live discount preview before checkout is submitted but is not yet wired into the UI — a planned enhancement rather than a defect.

## Payments — Webhook-Driven Confirmation

Stripe processes payments asynchronously. Relying solely on the direct response to a payment request would miss cases such as 3D Secure confirmation or a lost client-side network connection, where payment success is never directly observed. Accordingly:

1. `POST /payments/intent/:orderId` creates a `PaymentIntent` and returns a `clientSecret`, which the frontend completes via Stripe.js.
2. Stripe notifies `POST /payments/webhook` upon final confirmation.
3. The webhook signature (`stripe-signature` header) is verified via `constructEvent` to prevent request forgery, which requires `main.ts` to boot with `rawBody: true` since Stripe verification needs the unparsed request body.
4. Only after this verification does the order transition to `PAID` and stock actually decrement.

## Role-Based Access Control

Three roles: `CUSTOMER` (default), `STAFF`, `ADMIN`. A simple enum is used rather than a fine-grained permission matrix, which is sufficient for this project's scope. `STAFF` handles day-to-day operations: creating/editing products and categories (including pricing), viewing orders and reports, and adjusting inventory. `ADMIN`-only actions are reserved for less reversible operations: deactivating products or categories, full coupon management, and changing user roles (`PATCH /users/:id/role`).

## Testing

`npm run test` (unit) and `npm run test:e2e` (e2e). Current status: **101 unit tests + 30 e2e tests, all passing.**

### Unit Tests — business logic with Prisma mocked

| File | Coverage |
|---|---|
| `auth.service.spec.ts` (27) | login/register, password hashing, multi-session, token rotation, revocation |
| `orders.service.spec.ts` (35) | cart-to-order conversion, stock reservation, coupon application, access control |
| `coupons.service.spec.ts` (16) | discount calculation, caps, expiry, usage-count limits |
| `inventory.service.spec.ts` (12) | stock adjustment, negative-stock prevention, audit logging |
| `duration.spec.ts` (11) | parsing `15m`/`7d` for session-expiry calculation |

A shared `createMockPrisma()` helper in `src/test-utils/` mocks every Prisma delegate with `jest.fn()`. Its `$transaction` implementation actually executes the callback, so logic inside transactions is exercised. It does not model rollback, so atomicity itself is not covered by these tests — that is left to database-level testing.

### End-to-End Tests — full HTTP layer

The application boots normally (controllers, guards, validation pipes, exception filters, routing), with only `PrismaService` replaced by a mock.

- `auth.e2e-spec.ts` (14): input validation, rejection of forged/expired tokens, session endpoints
- `rbac.e2e-spec.ts` (11): STAFF/ADMIN boundary enforcement — each test is an executable specification of one documented permission
- `errors.e2e-spec.ts` (5): error response shape, JSON (not HTML) output, internal message non-leakage, log level correctness

`rbac.e2e-spec.ts` exists because this project's own documentation was previously incorrect about STAFF permissions. Documentation can drift silently; a failing test cannot.

**Out of scope for these tests**: transaction rollback, unique constraints, cascade deletes, and the raw SQL in `lowStock()` — all of which require a real PostgreSQL instance. The current structure (a `createTestApp` helper, with mocking isolated precisely at the `PrismaService` boundary) is designed so that substituting a real database connection is a one-line change rather than a rewrite.

### Structural note

Global configuration (helmet, CORS, prefix, ValidationPipe, filter, interceptor) lives in `src/app.config.ts` rather than inline in `main.ts`, because the e2e tests call this same function directly. Keeping a single source of truth prevents the two from drifting apart, which could otherwise let a new validation rule appear tested when it is not.

## Current Limitations and Next Steps for Production

The following were scoped out deliberately to keep the project focused, and are required before real commercial use:

- ~~Automated tests (unit/e2e) not written~~ — **Resolved**: 101 unit tests + 30 e2e tests, all passing. See the Testing section above.
- ~~Rate limiting was global only~~ — **Resolved**: `login` and `register` now have a dedicated, stricter limit (5 requests/minute per IP), in addition to the overall 100/minute cap.
- ~~Only one refresh token stored at a time~~ — **Resolved**: each login now creates an independent `Session` row; see the Authentication section above.
- **Stripe keys** in `.env.example` are placeholders and must be replaced with real test keys from a Stripe dashboard before payments can be exercised end-to-end.
- ~~Product image handling was limited to an array of URLs~~ — **Resolved**: real file uploads via `POST /uploads/product-image` (file-type and 5 MB validation), with an upload UI in the admin product form.
- ~~No structured logging or monitoring integration~~ — **Resolved**: every request is logged as a structured JSON line and reported to Sentry via `@sentry/nestjs`. Only unexpected errors (5xx) are reported; 4xx responses that are part of normal flow are not. Monitoring is fully disabled when `SENTRY_DSN` is unset, with no effect on local development. Note: Sentry integration currently covers the backend only; the frontend is not yet connected.

### Note on Prisma Client Generation in Restricted-Network Environments

The Prisma Client — which generates the `PrismaClient` class and enums such as `Role` and `OrderStatus` — requires downloading a query-engine binary from `binaries.prisma.sh` at generation time. In network-restricted environments (locked-down CI runners, offline containers, corporate proxies without that domain allowlisted), `npx prisma generate` will fail even though the rest of the toolchain works normally.

Workarounds such as bypassing the checksum, enabling the `driver adapters` preview feature, or setting `engineType = "wasm"` do not reliably solve this, since the engine binary itself is still required at runtime.

If you hit this, the only real fix is running `npx prisma generate` from a machine/environment with unrestricted network access — the generated client is a local, gitignored artifact (`node_modules/.prisma/client`) and is never committed, so this is a one-time step per environment, not a code change.

`npx prisma generate && npm run build` should always be run as a final verification step before deploying, since it performs full Prisma field-name validation against the schema that a partial or stale client would miss.

## Frontend Architecture

Built with Next.js App Router, consuming the same backend API. All storefront routes are grouped under a `(shop)` route group that applies a shared Header/Footer, while `/admin` sits outside this group with its own independent layout (a full-page sidebar) — without this separation, the admin panel would be constrained by the storefront's narrower container.

### ISR for Product Pages, Dynamic Rendering for the Listing

The single-product page (`/products/[slug]`) uses `revalidate = 3600`: the first visit renders and caches the page, and subsequent visits are served from cache for up to an hour. This suits content that changes infrequently (description, price) but should not be fixed at build time, since new products are added by admins at runtime.

The product listing (`/products`) is `force-dynamic`, since each filter/search combination is effectively a distinct page — caching one would risk serving stale or incorrect filtered results to other users.

### Token Storage

`accessToken` and `refreshToken` are stored as `httpOnly` cookies rather than in `localStorage` or accessible client-side storage, preventing token theft via XSS. The tradeoff is that client components cannot fetch the backend directly, since they cannot access the token — addressed by an `/api/proxy/[...path]` route that reads the cookie server-side, attaches the real `Authorization` header, and performs a refresh when needed. All client-side requests go through this same-origin proxy rather than the backend directly.

### Bugs Found During Development

- **Disallowed export from a route handler**: a helper function, `setAuthCookies`, was initially defined and exported directly from `route.ts`. Next.js only permits exporting HTTP-method functions (`GET`, `POST`, etc.) from route files, and `next build` failed with an explicit error. Resolved by moving the helper to `lib/cookies.ts`.
- **Raw HTML error instead of clean JSON**: when the backend was unreachable, the proxy route's `fetch()` call rejected without a try/catch, and Next.js returned a raw HTML error page. On the client, `res.json()` then failed on that HTML, producing a second, confusing error. Identified via a direct curl test against a stopped backend rather than code review. Resolved by wrapping the fetch in try/catch and returning a `502` with a clean JSON body.
- **`refreshToken` cookie not updated after a silent refresh**: `auth.refresh()` always issues a new refresh token via rotation, but the proxy route only updated the `accessToken` cookie after a silent refresh, leaving `refreshToken` stale. The stale cookie no longer matched the newly stored hash on the `Session` row, causing the second silent refresh to always fail and forcing re-authentication. This latent bug predated the current session model but surfaced while implementing the `Session` table, since that change touched the same code path. Resolved by having `tryRefresh` return both tokens and updating both cookies.
- **`payments.controller.ts` failed to compile**: `req.rawBody` in NestJS is typed as `Buffer | undefined`, since it is only populated when a request body is present, but `handleWebhook` expected a `Buffer` parameter — a compile error under `strictNullChecks: true` that would break `npm run build`. Caught during a full `tsc --noEmit` pass across the backend. Resolved with an explicit check that returns a clean `400` for a missing body instead of passing `undefined` to the Stripe SDK.
- **All 4xx responses logged at ERROR level with a full stack trace**: a 403 or 401 indicates correct API behavior, not a defect, and this logging pattern buried genuine 5xx errors in noise — undermining the newly added Sentry integration. Identified while running the e2e tests, whose output was full of stack traces for responses that were *expected* to be 403. Resolved so that 5xx remains at error level with a stack trace, while 4xx logs a single warn-level line.

## Next Phase

Automated testing, multi-session support, and Sentry integration — previously flagged as limitations — are now implemented, with 131 tests passing. Remaining steps before production deployment:

1. **Run `npx prisma generate && npm run build`** locally to produce a fully validated Prisma Client and confirm a clean production build.
2. **Run `npx prisma migrate dev`** to create the `Session` table, since the schema changed and `hashedRefreshToken` was removed from `User`.
3. **Configure real Stripe test keys** from an actual Stripe dashboard.

Not currently required but recommended as follow-up work: running the e2e suite against a real PostgreSQL instance for rollback and constraint coverage, a device-management UI under `/account`, and extending Sentry coverage to the frontend.
