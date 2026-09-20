# E-commerce Platform

A full-featured e-commerce reference implementation with a real, production-style backend. See [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture and design decisions.

## Project Status

| Component | Status |
|---|---|
| Backend (NestJS + PostgreSQL) | ✅ Complete. `tsc --noEmit` passes with zero errors. 101 unit tests + 30 e2e tests, all passing |
| Frontend (Next.js) | ✅ Complete. `tsc` and `next build` pass with zero errors; graceful-degradation behavior verified against a stopped backend |
| Admin Panel | ✅ Complete, part of the frontend (`/admin/*`) |
| Automated tests | ✅ 131 tests. Details in [ARCHITECTURE.md](./ARCHITECTURE.md#testing) |
| Multi-session support | ✅ Dedicated `Session` table, refresh token rotation, per-device management |
| Monitoring | ✅ Sentry (backend), disabled by default when `SENTRY_DSN` is unset |

**Known limitations:** this is a production-style reference implementation, not yet hardened for commercial-scale deployment. See [ARCHITECTURE.md § Current Limitations and Next Steps for Production](./ARCHITECTURE.md#current-limitations-and-next-steps-for-production) for the full breakdown.

## Tech Stack — Backend

- **NestJS 10** — server-side framework
- **PostgreSQL 16** — database
- **Prisma 5** — ORM
- **Passport + JWT** — authentication (15-minute access token, 7-day refresh token)
- **Stripe** — payments (test mode)
- **class-validator** — input validation
- **Swagger** — auto-generated API documentation

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (or Docker)

## Setup

```bash
cd backend
npm install
cp .env.example .env   # fill in real values

# Database (or use docker-compose.yml at the project root)
docker compose -f ../docker-compose.yml up -d

npx prisma generate
npx prisma migrate dev --name init
npm run seed

npm run start:dev
```

The API runs at `http://localhost:4000/api/v1`. Swagger docs are available at `http://localhost:4000/api/docs`.

### Running Tests

```bash
npm run test       # 101 unit tests
npm run test:e2e   # 30 e2e tests
npm run test:cov   # with coverage report
```

Tests require no running database or server — the Prisma layer is mocked. Test coverage boundaries (transaction rollback, database constraints) are documented in [ARCHITECTURE.md](./ARCHITECTURE.md#testing).

The full stack has also been manually verified end-to-end against real infrastructure (Postgres, Stripe test mode, Sentry) — see [`docs/VERIFICATION.md`](./docs/VERIFICATION.md).

## Seeded Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | Admin@12345 |
| Customer | customer@example.com | Customer@12345 |

Sample coupon code: `WELCOME10` (10% off, $50 minimum order)

## Testing Payment Webhooks (Stripe)

```bash
stripe listen --forward-to localhost:4000/api/v1/payments/webhook
```

Set the printed `whsec_...` value as `STRIPE_WEBHOOK_SECRET`.

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # database schema
│   └── seed.ts
└── src/
    ├── auth/               # registration, login, JWT
    ├── users/               # profile and role management
    ├── categories/
    ├── products/            # search and filtering
    ├── inventory/            # stock and adjustment history
    ├── cart/
    ├── orders/               # cart-to-order conversion, coupon application, stock reservation
    ├── coupons/
    ├── payments/              # Stripe PaymentIntent + webhook handling
    ├── reports/                 # sales reports for the admin panel
    ├── common/                   # guards, decorators, exception filters
    └── prisma/                    # PrismaService
```

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | run in watch mode |
| `npm run build` | production build |
| `npm run prisma:migrate` | create a new migration |
| `npm run seed` | seed the database with sample data |
| `npm run test` | unit tests |
| `npm run test:e2e` | end-to-end tests |
| `npm run test:cov` | tests with coverage report |

## Tech Stack — Frontend

- **Next.js 14 (App Router)** — SSR for auth-gated pages, ISR for product pages, `force-dynamic` for the filtered product listing
- **Zustand** — used only for the cart badge counter; all other state is server-driven
- **jose** — JWT signature verification in middleware (Edge runtime) and Server Components
- **Stripe Elements** — payment form
- **Tailwind CSS** — styling, no additional component library

## Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local   # JWT_ACCESS_SECRET must match the backend exactly

npm run dev
```

Runs at `http://localhost:3000`. The backend must also be running on port 4000 (see above) for full functionality.

### Frontend Auth Architecture

`accessToken` and `refreshToken` are stored as `httpOnly` cookies, inaccessible to browser-side JavaScript — a mitigation against XSS-based token theft. Client-side code never calls the backend directly; all requests are routed through `/api/proxy/*`, which reads the cookie, attaches the `Authorization` header server-side, and performs a silent refresh when the access token has expired.

`middleware.ts` protects `/cart`, `/checkout`, `/account`, and `/admin` at the edge, verifying the JWT signature before the page renders.

## Operational Features

- **Product image uploads**: the admin product form supports file uploads. Files are stored in `backend/uploads/products/` and served from `/uploads/...`. JPEG/PNG/WebP only, 5 MB limit. The upload directory is gitignored, so uploaded images are never committed.
- **Two-tier rate limiting**: 100 requests/minute globally, with a stricter 5 requests/minute per IP on `login` and `register` to slow brute-force attempts.
- **Structured logging**: every request is logged as a single JSON line (method, path, status, duration, userId, IP), suitable for ingestion by tools like Datadog or CloudWatch. Log levels are severity-aware: 5xx errors log at `error` with a full stack trace, while 4xx errors (expected outcomes like 401/404) log at `warn` to keep signal-to-noise high.
- **Sentry monitoring**: unexpected errors are reported to Sentry when `SENTRY_DSN` is set; leaving it empty (the default) disables it entirely with no code changes required. Routine 4xx errors are not reported.
- **Concurrent multi-device sessions**: each login creates an independent session, so signing in on one device does not invalidate others. Users can list active sessions (`GET /auth/sessions`), revoke one (`DELETE /auth/sessions/:id`), or log out of all devices (`POST /auth/logout-all`). Refresh tokens rotate on every use; reuse of an old token invalidates the entire session.

## Verified Setup

The setup steps in [ARCHITECTURE.md](./ARCHITECTURE.md#next-phase) have already been run and confirmed end-to-end on a local deployment: `npx prisma generate && npm run build` passes with zero errors, the `Session` table migration has been applied, and a live Stripe test-card payment succeeded. See ARCHITECTURE.md for the full verification record. If you're setting this up fresh on a different machine, just follow the Setup steps above — they cover the same ground.



## License

MIT - see [LICENSE](LICENSE).