import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { MikroORM } from '@mikro-orm/postgresql';
import { Booking } from '../bookings/entities/bookings.entity';
import { DEFAULT_TENANT_ID } from '../common/constants/tenant';
import { tenantContext } from '../common/tenancy/tenant-context';
import { Contact } from '../contacts/entities/contact.entity';
import { Field } from '../fields/entities/field.entity';
import { Pitch } from '../pitches/entities/pitch.entity';
import { Slot } from '../slots/entities/slot.entity';
import { createOrmOptions } from './mikro-orm.options';

// Runs outside Nest, so it gets no ConfigModule and no direnv guarantee — load .env
// explicitly here.
loadDotenv();

/**
 * Reference data for a freshly migrated booking database: one field with its pitches, and
 * a couple of contacts. Without a field there is nothing to book, and without a contact
 * nothing to book it for. Run via `npm run seed:booking`.
 *
 * Idempotent — rows are looked up by name/email first, so re-running only fills gaps.
 * Bookings are deliberately not seeded: creating them goes through BookingsService, which
 * owns the recurrence and allocation rules.
 */
const FIELD_NAME = process.env.SEED_FIELD_NAME ?? 'Hlavní hřiště';
const PITCH_NAMES = (process.env.SEED_PITCH_NAMES ?? 'A,B')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const CONTACTS = [
  { firstName: 'Jan', lastName: 'Novák', email: 'jan.novak@example.com', phone: '777123456' },
  { firstName: 'Petr', lastName: 'Svoboda', email: 'petr.svoboda@example.com', phone: null },
];

async function seed(): Promise<void> {
  const orm = await MikroORM.init({
    ...createOrmOptions({ clientUrl: process.env.DATABASE_URL }),
    entities: [Contact, Field, Pitch, Booking, Slot],
  });

  try {
    // TENANT_FILTER and the tenantId onCreate hook both read the request's tenant context,
    // which doesn't exist outside one — open it explicitly for the whole seed.
    await tenantContext.run({ userId: 'seed', tenantId: DEFAULT_TENANT_ID }, async () => {
      // Outside a request there's no RequestContext, so work on an explicit fork.
      const em = orm.em.fork();

      const existingField = await em.findOne(Field, { name: FIELD_NAME });

      if (existingField) {
        console.log(`Field "${FIELD_NAME}" already exists, skipping.`);
      } else {
        // The persist cascade inserts the pitches with the field, in one flush.
        em.create(Field, {
          name: FIELD_NAME,
          pitches: PITCH_NAMES.map((name) => ({ name })),
        });
        console.log(`Seeded field "${FIELD_NAME}" with ${PITCH_NAMES.length} pitch(es).`);
      }

      for (const contact of CONTACTS) {
        if (await em.findOne(Contact, { email: contact.email })) {
          console.log(`Contact ${contact.email} already exists, skipping.`);
          continue;
        }

        em.create(Contact, { ...contact, show: true });
        console.log(`Seeded contact ${contact.email}.`);
      }

      await em.flush();
      console.log(`Done (tenant: ${DEFAULT_TENANT_ID}).`);
    });
  } finally {
    await orm.close(true);
  }
}

seed().catch((error: unknown) => {
  console.error('Failed to seed booking data:', error);
  process.exitCode = 1;
});
