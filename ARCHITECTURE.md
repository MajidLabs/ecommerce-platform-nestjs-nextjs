# Architecture

## Overview

Northfield is a two-service application: a NestJS REST API backend and a Next.js frontend, backed by PostgreSQL. The frontend never talks to the backend directly from the browser — all requests go through a same-origin proxy route, keeping auth tokens in httpOnly cookies and out of client-side JavaScript.

```
Browser
  │
  ▼
Next.js (SSR/ISR pages + /api/proxy route, httpOnly cookies)
  │
  ▼
NestJS API (JWT auth, business logic)
  │
  ▼
PostgreSQL (via Prisma ORM)
```

## Backend (NestJS)

Organized by feature module, each with its own controller, service, and DTOs:

- **auth** — registration, login, JWT access/refresh token issuance, refresh rotation with reuse detection, multi-session tracking (`sessions` table, one row per login)
- **users** — profile and role management
- **products** — catalog CRUD, filtering/search
- **categories** — category CRUD
- **cart** — cart item management
- **orders** — order creation and status transitions
- **coupons** — coupon validation and management
- **inventory** — stock levels, manual adjustments, low-stock detection
- **payments** — Stripe payment intents and webhook handling
- **reports** — sales/revenue reporting with date-range filtering

Cross-cutting concerns live in **common**: JWT auth guard, role-based access guard, a global HTTP exception filter (which also reports 5xx errors to Sentry), and a structured JSON request-logging interceptor.

### Auth flow

1. Login/register issues a short-lived **access token** and a longer-lived **refresh token**, both JWTs.
2. The refresh token's fingerprint (SHA-256 hash, then bcrypt) is stored per session — not the raw token — so a leaked database can't be used to forge sessions.
3. On refresh, the old token is checked for reuse. If a token is reused (e.g. an old, already-rotated token is replayed), the entire session is revoked, not just that token — this catches token theft.
4. Multiple simultaneous sessions are supported; logging in on a new device does not invalidate other active sessions.

### Data layer

Prisma ORM against PostgreSQL 16. Migrations are tracked in `backend/prisma/migrations`. The seed script (`npm run seed`) populates demo products, an admin account, and a customer account.

## Frontend (Next.js, App Router)

- **`(shop)` route group** — public storefront: home, product listing/detail, cart, checkout, order history
- **`admin` route group** — dashboard, product/inventory/order/customer/coupon/report management
- **`/api/proxy/[...path]`** — the only route that talks to the backend. It forwards requests (including raw bytes and original `Content-Type`, so multipart file uploads aren't corrupted) and attaches the auth cookie server-side. On backend failure it returns clean JSON instead of leaking a raw HTML error page.
- **`middleware.ts`** — route protection based on auth cookie presence/role.
- **State**: Zustand for client-side cart state; server components handle data fetching for pages via `lib/server-api.ts`.
- **Payments**: Stripe Elements on the checkout page, talking to the backend's payment-intent endpoint through the proxy.

### Error handling

Server-side fetch helpers distinguish "the backend is unreachable" from "the query returned zero results," so the UI shows an honest error state (with auto-recovery on refresh) instead of a misleading "no results" message when the backend is down.

## Monitoring

`@sentry/nestjs` is wired into the backend via `instrument.ts` (loaded before Nest bootstraps) and the global exception filter. Only 5xx errors are reported — 4xx client errors are not, to keep noise down.

## Testing

- **Unit tests** (Jest): 101 tests across 5 suites — inventory, orders, coupons, auth, and duration utilities.
- **End-to-end tests** (Jest + Supertest): 30 tests across 3 suites — auth flows, error handling, and role-based access control.

## Security notes

- Refresh tokens are never stored in plaintext or in a directly-hashable form (see Auth flow above).
- Rate limiting: 5 requests/minute per IP on login/register endpoints.
- Auth tokens live in httpOnly cookies, never exposed to client-side JavaScript.
- Real secrets (`backend/.env`, `frontend/.env.local`) are gitignored; only `.env.example` files are committed.
