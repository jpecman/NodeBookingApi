import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { MikroORM } from '@mikro-orm/postgresql';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export interface TestContext {
  app: INestApplication;
  moduleRef: TestingModule;
  orm: MikroORM;
  close(): Promise<void>;
}

/**
 * Boots the real application against the database globalSetup prepared.
 *
 * configureApp() is the same function main.ts calls, so the harness can't drift from
 * production wiring — a copy here would go stale invisibly, with the tests still passing.
 *
 * One app per spec file (beforeAll/afterAll). Sharing across files isn't possible anyway:
 * each Jest test file gets its own module registry, even under --runInBand.
 */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  // Several specs deliberately provoke 500s and 409s; their stack traces would bury the
  // reporter output. E2E_VERBOSE=1 turns logging back on when something is misbehaving.
  const app = moduleRef.createNestApplication({
    logger: process.env.E2E_VERBOSE ? undefined : false,
  });

  configureApp(app);

  await app.init();

  return {
    app,
    moduleRef,
    orm: moduleRef.get(MikroORM),
    // app.close() runs MikroOrmModule's onModuleDestroy, closing the pool. Without it
    // every spec file leaks connections and Jest hangs on open handles.
    close: () => app.close(),
  };
}
