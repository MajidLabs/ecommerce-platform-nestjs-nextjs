import * as dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/nestjs';

// This file has to be the very first thing main.ts imports — Sentry's
// NestJS SDK instruments other modules as they're required, so anything
// imported before Sentry.init() runs is invisible to it.
//
// With SENTRY_DSN unset (the default for local development, see
// .env.example), the SDK quietly no-ops: nothing is sent anywhere and no
// other file needs to change to run without it.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  // Fraction of requests traced for performance monitoring, not just
  // errors. 1.0 (100%) is fine for demos but noisy/costly at real
  // traffic, so this defaults low and is tunable per-environment.
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
});



