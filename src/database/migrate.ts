import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { MikroORM, type Options } from '@mikro-orm/postgresql';
import { Booking } from '../bookings/entities/bookings.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Field } from '../fields/entities/field.entity';
import { Pitch } from '../pitches/entities/pitch.entity';
import { Slot } from '../slots/entities/slot.entity';
import { User } from '../users/entities/user.entity';
import { BOOKING_MIGRATIONS } from './migrations';
import { AUTH_MIGRATIONS } from './migrations/auth';
import { AUTH_CONTEXT, BOOKING_CONTEXT, createOrmOptions } from './mikro-orm.options';

// Runs outside Nest, so it gets no ConfigModule and no direnv guarantee — load .env
// explicitly here.
loadDotenv();

/**
 * Migration runner for both contexts, used instead of the MikroORM CLI (which would
 * need its own TypeScript loader). The running app never migrates on its own.
 *
 *   ts-node src/database/migrate.ts <booking|auth> up
 *   ts-node src/database/migrate.ts <booking|auth> down        # reverts the last one
 *   ts-node src/database/migrate.ts <booking|auth> create <Name>
 *
 * `create` diffs the entities against the live database. For the booking context that
 * database is BookingApi's own, so a generated migration would try to reshape BookingApi's
 * tables — review it (or don't generate one) before running it.
 */
const contexts: Record<string, () => Options> = {
  [BOOKING_CONTEXT]: () => ({
    ...createOrmOptions({
      clientUrl: process.env.DATABASE_URL,
      migrationsDir: 'migrations',
      migrations: BOOKING_MIGRATIONS,
    }),
    entities: [Contact, Field, Pitch, Booking, Slot],
  }),
  [AUTH_CONTEXT]: () => ({
    ...createOrmOptions({
      clientUrl: process.env.AUTH_DATABASE_URL,
      migrationsDir: 'migrations/auth',
      migrations: AUTH_MIGRATIONS,
    }),
    entities: [User],
  }),
};

async function migrate(): Promise<void> {
  const [contextName, command, name] = process.argv.slice(2);
  const options = contexts[contextName];

  if (!options || !['up', 'down', 'create'].includes(command)) {
    throw new Error(
      `Usage: migrate.ts <${Object.keys(contexts).join('|')}> <up|down|create> [name]`,
    );
  }

  const orm = await MikroORM.init(options());

  try {
    if (command === 'create') {
      const result = await orm.migrator.create(undefined, false, false, name);
      console.log(
        result.fileName
          ? `Created ${result.fileName} — add it to the context's migrations/index.ts.`
          : 'No schema changes to migrate.',
      );
      return;
    }

    const executed = command === 'up' ? await orm.migrator.up() : await orm.migrator.down();
    const verb = command === 'up' ? 'Applied' : 'Reverted';
    console.log(
      executed.length
        ? `${verb}: ${executed.map((migration) => migration.name).join(', ')}`
        : 'Nothing to do.',
    );
  } finally {
    await orm.close(true);
  }
}

migrate().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
