import { PrismaService } from '../prisma/prisma.service';

type Delegate = Record<string, jest.Mock>;

function makeDelegate(): Delegate {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  };
}

const MODELS = [
  'user',
  'session',
  'address',
  'category',
  'product',
  'productImage',
  'inventory',
  'stockMovement',
  'cart',
  'cartItem',
  'order',
  'orderItem',
  'coupon',
  'payment',
] as const;

export type MockPrisma = Record<(typeof MODELS)[number], Delegate> & {
  $transaction: jest.Mock;
};

/**
 * Builds a fully-mocked PrismaService. Every delegate method is a jest.fn()
 * that returns undefined until a test sets its return value, so a test only
 * has to stub the calls it actually cares about.
 *
 * `$transaction` runs the callback immediately with the same mock as the
 * transaction client. That means interactive transactions are exercised
 * for real (the callback body runs, in order, against the mocks) rather
 * than being stubbed out — but note the mock cannot roll back, so these
 * tests verify the *logic inside* the transaction, not Postgres's atomicity
 * guarantee itself. That guarantee is the database's job and is covered by
 * the e2e tests instead.
 */
export function createMockPrisma(): MockPrisma {
  const mock: any = {};
  for (const model of MODELS) {
    mock[model] = makeDelegate();
  }
  mock.$transaction = jest.fn((arg: any) =>
    typeof arg === 'function' ? arg(mock) : Promise.all(arg),
  );
  return mock as MockPrisma;
}

export const prismaMockProvider = () => {
  const mock = createMockPrisma();
  return {
    mock,
    provider: { provide: PrismaService, useValue: mock },
  };
};
