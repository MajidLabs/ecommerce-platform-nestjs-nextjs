# Manual End-to-End Verification

Automated `test:e2e` runs against a mocked Prisma layer (see `src/test-utils/prisma-mock.ts`) for speed and determinism. The steps below record a full manual verification of the same flows against real infrastructure: a real Postgres instance, real Stripe test-mode payments, and Sentry error monitoring.

## Phase 0 — Prerequisites
- Node ≥ 20, Postgres 16 or Docker

## Phase 1 — Database
- `docker compose up -d`

## Phase 2 — Backend setup
- `cd backend && npm install && cp .env.example .env`
- `npx prisma generate && npx prisma migrate dev --name init`
- `npm run seed` → seeds `admin@example.com / Admin@12345`
- `npm run build` → zero TypeScript errors
- `npm run start:dev` → `Server running on http://localhost:4000/api/v1`

## Phase 3 — Backend health checks
- `localhost:4000/api/docs` → Swagger loads
- `curl localhost:4000/api/v1/products` → 5 seeded products
- `POST /auth/login` with admin creds → returns `accessToken` + `refreshToken`

## Phase 4 — Frontend setup
- `cd frontend && npm install && cp .env.local.example .env.local`
- `JWT_ACCESS_SECRET` must match backend's `.env`
- `npm run build && npm run dev`

## Phase 5 — User flow
- Homepage/product filters work
- Login as `customer@example.com / Customer@12345`
- Add to cart → checkout with coupon `WELCOME10` (subtotal > $50)
- Pay with Stripe test card `4242 4242 4242 4242` — confirmed working
- `/account/orders` shows the order

## Phase 6 — Admin panel
- KPIs, product CRUD, inventory low-stock warnings + manual adjustment, order status changes, customer role changes, coupon creation, report date filters — all verified

## Phase 7 — Resilience test
- Backend stopped mid-session while frontend running: caught and fixed a bug where `/products` showed a misleading "No products match those filters" instead of a real error. Now shows an honest connection-error message and auto-recovers on refresh once the backend is back.

## Monitoring
- Sentry (`@sentry/nestjs`) wired; only 5xx errors are reported (4xx are not)
- Verified end-to-end: a deliberately thrown test error appeared correctly in the Sentry dashboard
- Fixed a real bug in the process: `instrument.ts` read `SENTRY_DSN` before `ConfigModule` had loaded `.env`, so Sentry always initialized with an empty DSN — fixed by loading `dotenv` before the Sentry import

## Result
Phases 0–7 complete with no errors. This, together with the mocked automated suite (101 unit tests, 30 e2e tests), is the project's full test coverage.
