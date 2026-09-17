import { join } from 'path';
import type { Constructor } from '@mikro-orm/core';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migration, Migrator } from '@mikro-orm/migrations';
import { type Options, PostgreSqlDriver } from '@mikro-orm/postgresql';

/**
 * MikroORM context names. There are two databases, so both contexts are named: that's
 * what lets MikroOrmModule.forMiddleware() give every request a fork of each
 * EntityManager (an unnamed context isn't included in it). Inject with
 * `@InjectRepository(Entity, BOOKING_CONTEXT)` / `@InjectEntityManager(BOOKING_CONTEXT)`.
 */
export const BOOKING_CONTEXT = 'booking';
export const AUTH_CONTEXT = 'auth';

interface ContextOptions {
  clientUrl: string | undefined;
  debug?: boolean;
  migrationsDir: string;
  migrations: Constructor<Migration>[];
}

/**
 * Settings shared by the Nest modules (DatabaseModule, AuthDatabaseModule) and the
 * standalone scripts (migrate.ts, seed-auth-user.ts), which run outside Nest.
 */
export function createOrmOptions({
  clientUrl,
  debug = false,
  migrationsDir,
  migrations,
}: ContextOptions): Options {
  return {
    driver: PostgreSqlDriver,
    clientUrl,
    // Decorators are TypeScript's legacy (experimentalDecorators) flavour; types are
    // always given explicitly, reflect-metadata only fills gaps.
    metadataProvider: ReflectMetadataProvider,
    // The databases already exist on nunicek-ts — never try to CREATE DATABASE.
    ensureDatabase: false,
    debug: debug ? ['query'] : false,
    extensions: [Migrator],
    migrations: {
      // Explicit list instead of folder discovery: the migrator is an ES module and
      // can't import .ts files through ts-node. Add new migrations to the index.ts.
      migrationsList: migrations,
      // Where `migrate.ts <context> create` writes new files.
      pathTs: join(__dirname, migrationsDir),
      emit: 'ts',
      // Diff against the live database rather than a committed snapshot file.
      snapshot: false,
      // Each migration in its own transaction, and one failure rolls back the whole run.
      transactional: true,
      allOrNothing: true,
    },
  };
}
