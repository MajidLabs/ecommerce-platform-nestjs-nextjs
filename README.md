# Northfield — Full-Stack E-Commerce Platform

A production-quality e-commerce platform built from scratch with a NestJS backend and a Next.js frontend, including a complete customer storefront and admin panel.

## Features

- **Storefront**: product catalog with filtering, cart, checkout with Stripe payments, coupon codes, order history
- **Admin panel**: dashboard with KPIs and revenue chart, product management, inventory tracking with low-stock warnings, order status management, customer role management, coupon management, sales reports with date-range filtering
- **Auth**: JWT-based authentication with access + refresh tokens, refresh token rotation with reuse detection, multi-session support
- **Payments**: Stripe integration with webhook handling
- **File uploads**: product image uploads with MIME-type and size validation
- **Monitoring**: Sentry error tracking (5xx errors only)
- **Testing**: 101 unit tests across 5 suites, 30 end-to-end tests across 3 suites (auth, error handling, role-based access control)
- **Resilience**: graceful degradation and auto-recovery when the backend is temporarily unavailable

## Tech Stack

**Backend**
- NestJS
- Prisma ORM + PostgreSQL 16
- JWT authentication (access + refresh tokens)
- Stripe webhooks
- Multer for file uploads
- Sentry for error monitoring

**Frontend**
- Next.js (App Router, SSR/ISR)
- Zustand for state management
- Stripe Elements
- Tailwind CSS
- Same-origin `/api/proxy` route with httpOnly cookies for secure token handling

**Infrastructure**
- Docker Compose (PostgreSQL container)

## Getting Started

### Prerequisites
- Node.js ≥ 20
- Docker (for PostgreSQL) or a local Postgres 16 instance

### Setup

```bash
# 1. Start the database
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run start:dev
# → Server running on http://localhost:4000/api/v1

# 3. Frontend (in a new terminal)
cd frontend
npm install
cp .env.local.example .env.local
# Make sure JWT_ACCESS_SECRET in .env.local matches the backend's .env
npm run build
npm run dev
```

### Seeded accounts

| Role     | Email                  | Password       |
|----------|-------------------------|----------------|
| Admin    | admin@example.com       | Admin@12345    |
| Customer | customer@example.com    | Customer@12345 |

### Test payment card (Stripe test mode)

`4242 4242 4242 4242` — any future expiry date, any CVC.

## Testing

```bash
cd backend
npm run test        # unit tests
npm run test:e2e    # end-to-end tests
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed breakdown of the system design.

## Author

Built by [MajidLabs](https://github.com/MajidLabs).
