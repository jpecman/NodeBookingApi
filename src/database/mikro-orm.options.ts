import { join } from 'path';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { type Options, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MIGRATIONS } from './migrations';

interface OrmOptions {
  clientUrl: string | undefined;
  debug?: boolean;
}

/**
 * Settings shared by DatabaseModule and the standalone scripts (migrate.ts, the seeds),
 * which run outside Nest.
 *
 * There is one database and one unnamed MikroORM context, so nothing injects by context
 * name and MikroOrmModule registers the per-request EntityManager fork itself.
 */
export function createOrmOptions({ clientUrl, debug = false }: OrmOptions): Options {
  return {
    driver: PostgreSqlDriver,
    clientUrl,
    // Decorators are TypeScript's legacy (experimentalDecorators) flavour; types are
    // always given explicitly, reflect-metadata only fills gaps.
    metadataProvider: ReflectMetadataProvider,
    // The database is expected to exist — never try to CREATE DATABASE.
    ensureDatabase: false,
    debug: debug ? ['query'] : false,
    extensions: [Migrator],
    migrations: {
      // Explicit list instead of folder discovery — see migrations/index.ts.
      migrationsList: MIGRATIONS,
      // Where `migrate.ts create` writes new files.
      pathTs: join(__dirname, 'migrations'),
      emit: 'ts',
      // Diff against the live database rather than a committed snapshot file.
      snapshot: false,
      // Each migration in its own transaction, and one failure rolls back the whole run.
      transactional: true,
      allOrNothing: true,
    },
  };
}
