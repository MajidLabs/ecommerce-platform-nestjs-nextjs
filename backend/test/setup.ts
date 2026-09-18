import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/app.config';
import { createMockPrisma, MockPrisma } from '../src/test-utils/prisma-mock';

/**
 * Boots the real application — real controllers, real guards, real
 * validation pipes, real exception filter, real routing — with only the
 * database swapped for an in-memory mock.
 *
 * What this DOES cover: that routes are wired up, that DTO validation
 * actually rejects bad input, that auth and role guards are attached to
 * the endpoints they should be, that errors come back in the documented
 * shape, and that the global prefix and interceptors are applied.
 *
 * What this DOES NOT cover: anything that is the database's job —
 * transaction rollback, unique constraints, cascading deletes, the raw
 * SQL in `lowStock()`. Those need a real Postgres. Running the same
 * suite against a live test database is the natural next step; the
 * structure here (one `createTestApp` helper, mock injected at the
 * PrismaService boundary) is deliberately set up so that swapping in a
 * real PrismaService is a one-line change rather than a rewrite.
 */
export interface TestContext {
  app: INestApplication;
  prisma: MockPrisma;
}

export async function createTestApp(): Promise<TestContext> {
  process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret';
  process.env.JWT_ACCESS_EXPIRATION ??= '15m';
  process.env.JWT_REFRESH_EXPIRATION ??= '7d';
  process.env.STRIPE_SECRET_KEY ??= 'sk_test_e2e_placeholder';
  process.env.DATABASE_URL ??= 'postgresql://e2e:e2e@localhost:5432/e2e';

  const prisma = createMockPrisma();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();

  return { app, prisma };
}
