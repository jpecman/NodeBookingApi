import { readFileSync } from 'fs';
import type { MikroORM } from '@mikro-orm/postgresql';
import { HANDSHAKE_FILE, type Handshake } from './handshake';

/** Child-first, though CASCADE would cover it — explicit reads better than clever. */
const DOMAIN_TABLES = ['slots', 'bookings', 'pitches', 'fields', 'contacts'];

/**
 * A direnv shell exports the *development* DATABASE_URL, so a bug in setup-env.ts would
 * point this TRUNCATE at real data. Cheap insurance against a very expensive mistake.
 */
function assertTestDatabase(): void {
  const { databaseUrl } = JSON.parse(readFileSync(HANDSHAKE_FILE, 'utf8')) as Handshake;

  if (process.env.DATABASE_URL !== databaseUrl) {
    throw new Error(
      'Refusing to truncate: DATABASE_URL does not match the database globalSetup prepared.',
    );
  }
}

/**
 * Wipes domain state between tests.
 *
 * `users` is preserved: the shared admin's bcrypt hash is the suite's one expensive
 * fixture, and users is not tenant-filtered, so it carries no state the domain tests can
 * see. Re-running migrations per test would cost ~100x more, and wrapping each test in a
 * transaction isn't possible because every HTTP request takes its own pooled connection.
 */
export async function resetDomainTables(orm: MikroORM): Promise<void> {
  assertTestDatabase();

  const tables = DOMAIN_TABLES.map((table) => `"${table}"`).join(', ');
  // Raw SQL on the connection, not the EntityManager: the global EM refuses
  // context-specific calls, and every reader here works on its own fork anyway — a fork
  // starts with an empty identity map, so there is nothing to clear.
  await orm.em.getConnection().execute(`TRUNCATE TABLE ${tables} CASCADE`);
}

/** Only auth.e2e-spec.ts needs this — it's the one spec that mutates a user. */
export async function deleteUsersExcept(orm: MikroORM, email: string): Promise<void> {
  assertTestDatabase();

  await orm.em.getConnection().execute('DELETE FROM "users" WHERE "email" <> ?', [email]);
}
