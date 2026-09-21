import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import * as bcrypt from 'bcrypt';
import { MikroORM } from '@mikro-orm/postgresql';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DEFAULT_TENANT_ID } from '../src/common/constants/tenant';
import { ENTITIES } from '../src/database/entities';
import { createOrmOptions } from '../src/database/mikro-orm.options';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/user-role.enum';
import { ADMIN_EMAIL, ADMIN_PASSWORD, FIXTURE_BCRYPT_ROUNDS } from './support/constants';
import { resolveContainerRuntime } from './support/container-runtime';
import { HANDSHAKE_FILE, type Handshake } from './support/handshake';

/** Deliberately not the app's secret: nothing signed here should ever verify elsewhere. */
const JWT_SECRET = 'e2e-secret-not-used-anywhere-else';

const IMAGE = 'postgres:16-alpine';

export default async function globalSetup(): Promise<void> {
  const override = process.env.TEST_DATABASE_URL;
  let databaseUrl: string;

  console.log('\ne2e: preparing the test database…');

  if (override) {
    // Escape hatch for a machine with no container runtime available: point at any
    // Postgres. The migrator is idempotent, so an already-migrated database is fine.
    databaseUrl = override;
    console.log('e2e: using TEST_DATABASE_URL, no container started.');
  } else {
    // Docker hosts are found without help; this only does anything on a podman-only box.
    resolveContainerRuntime();

    console.log(`e2e: starting ${IMAGE}…`);
    const container = await new PostgreSqlContainer(IMAGE)
      .withDatabase('nodebooking_test')
      .withUsername('booking')
      .withPassword('booking')
      .withStartupTimeout(120_000)
      .start();

    // globalSetup and globalTeardown run in the same process, but Jest re-requires each
    // module, so module-level state would be lost between them. globalThis is the only
    // channel that survives.
    (globalThis as Record<string, unknown>).__PG_CONTAINER__ = container;
    databaseUrl = container.getConnectionUri();
  }

  await migrate(databaseUrl);
  await seedSharedAdmin(databaseUrl);

  const handshake: Handshake = { databaseUrl, jwtSecret: JWT_SECRET, usesContainer: !override };
  mkdirSync(dirname(HANDSHAKE_FILE), { recursive: true });
  writeFileSync(HANDSHAKE_FILE, JSON.stringify(handshake), 'utf8');

  // Workers fork from this process and inherit env; setup-env.ts re-reads the file anyway.
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = JWT_SECRET;
}

/**
 * src/database/migrate.ts is a script that runs on import, so it can't be called — these
 * are its load-bearing lines. Importing src/app.module.ts here would be wrong for a
 * different reason: ConfigModule.forRoot() runs at import time, before the env is set.
 */
async function migrate(clientUrl: string): Promise<void> {
  const orm = await MikroORM.init({ ...createOrmOptions({ clientUrl }), entities: ENTITIES });

  try {
    const executed = await orm.migrator.up();
    console.log(`e2e: migrations applied (${executed.length}).`);
  } finally {
    await orm.close(true);
  }
}

/**
 * One bcrypt hash for the whole run rather than one per spec file. User carries no
 * TENANT_FILTER, so this needs no tenant context.
 */
async function seedSharedAdmin(clientUrl: string): Promise<void> {
  const orm = await MikroORM.init({ ...createOrmOptions({ clientUrl }), entities: [User] });

  try {
    // Outside a request there's no RequestContext, so work on an explicit fork.
    const em = orm.em.fork();

    if (await em.findOne(User, { email: ADMIN_EMAIL })) {
      return;
    }

    em.create(User, {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, FIXTURE_BCRYPT_ROUNDS),
      role: UserRole.Administrator,
      tenantId: DEFAULT_TENANT_ID,
    });
    await em.flush();
  } finally {
    await orm.close(true);
  }
}
