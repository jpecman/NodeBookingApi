import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { MikroORM } from '@mikro-orm/postgresql';
import { Booking } from '../bookings/entities/bookings.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Field } from '../fields/entities/field.entity';
import { Pitch } from '../pitches/entities/pitch.entity';
import { Slot } from '../slots/entities/slot.entity';
import { User } from '../users/entities/user.entity';
import { createOrmOptions } from './mikro-orm.options';

// Runs outside Nest, so it gets no ConfigModule and no direnv guarantee — load .env
// explicitly here.
loadDotenv();

/**
 * Migration runner, used instead of the MikroORM CLI (which would need its own TypeScript
 * loader). The running app never migrates on its own.
 *
 *   ts-node src/database/migrate.ts up
 *   ts-node src/database/migrate.ts down          # reverts the last one
 *   ts-node src/database/migrate.ts create <Name>
 *
 * `create` diffs the entities against whatever DATABASE_URL points at, so review what it
 * produces before running it — and add the class to migrations/index.ts, which is the list
 * the migrator actually reads.
 */
const COMMANDS = ['up', 'down', 'create'];

async function migrate(): Promise<void> {
  const [command, name] = process.argv.slice(2);

  if (!COMMANDS.includes(command)) {
    throw new Error(`Usage: migrate.ts <${COMMANDS.join('|')}> [name]`);
  }

  // Entities are listed explicitly: there is no Nest module here to autoload them from.
  const orm = await MikroORM.init({
    ...createOrmOptions({ clientUrl: process.env.DATABASE_URL }),
    entities: [User, Contact, Field, Pitch, Booking, Slot],
  });

  try {
    if (command === 'create') {
      const result = await orm.migrator.create(undefined, false, false, name);
      console.log(
        result.fileName
          ? `Created ${result.fileName} — add it to migrations/index.ts.`
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
