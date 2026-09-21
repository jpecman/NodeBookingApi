import * as bcrypt from 'bcrypt';
import type { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Booking } from '../../src/bookings/entities/bookings.entity';
import { tenantContext } from '../../src/common/tenancy/tenant-context';
import { Contact } from '../../src/contacts/entities/contact.entity';
import { Field } from '../../src/fields/entities/field.entity';
import { Slot } from '../../src/slots/entities/slot.entity';
import { SlotStatus } from '../../src/slots/slot-status.enum';
import { formatTstzRange } from '../../src/slots/tstzrange';
import { User } from '../../src/users/entities/user.entity';
import { UserRole } from '../../src/users/user-role.enum';
import { FIXTURE_BCRYPT_ROUNDS, TENANT_A } from './constants';

/**
 * TENANT_FILTER and the tenantId onCreate hook both read an AsyncLocalStorage that only an
 * authenticated request opens — getCurrentTenantId() throws otherwise. Outside a request
 * there is no MikroORM RequestContext either, hence the explicit fork. Same shape as
 * src/database/seed-booking.ts.
 */
export function asTenant<T>(
  orm: MikroORM,
  tenantId: string,
  fn: (em: EntityManager) => Promise<T>,
): Promise<T> {
  return tenantContext.run({ userId: 'e2e', tenantId }, () => fn(orm.em.fork()));
}

/** User carries no TENANT_FILTER, so this needs no tenant context. */
export async function createUser(
  orm: MikroORM,
  opts: { email: string; password: string; tenantId?: string; role?: UserRole },
): Promise<User> {
  const em = orm.em.fork();

  const user = em.create(User, {
    email: opts.email,
    passwordHash: await bcrypt.hash(opts.password, FIXTURE_BCRYPT_ROUNDS),
    role: opts.role ?? UserRole.Administrator,
    tenantId: opts.tenantId ?? TENANT_A,
  });
  await em.flush();

  return user;
}

export function createContact(
  orm: MikroORM,
  data: Partial<Contact> = {},
  tenantId = TENANT_A,
): Promise<Contact> {
  return asTenant(orm, tenantId, async (em) => {
    const contact = em.create(Contact, {
      firstName: 'Jan',
      lastName: 'Novák',
      email: null,
      phone: null,
      show: true,
      ...data,
    });
    await em.flush();

    return contact;
  });
}

export function createField(
  orm: MikroORM,
  name: string,
  pitchNames: string[],
  tenantId = TENANT_A,
): Promise<Field> {
  return asTenant(orm, tenantId, async (em) => {
    // The persist cascade inserts the pitches with the field, in one flush.
    const field = em.create(Field, { name, pitches: pitchNames.map((pitch) => ({ name: pitch })) });
    await em.flush();

    return field;
  });
}

/**
 * A booking plus one slot written straight to the database, bypassing BookingsService.
 *
 * Used to set up pre-existing occupancy — including, deliberately, occupancy owned by a
 * *different* tenant, which is how bookings.e2e-spec.ts provokes the exclusion constraint
 * without any concurrency.
 */
export function createRawSlot(
  orm: MikroORM,
  opts: {
    pitchId: string;
    from: Date;
    to: Date;
    tenantId?: string;
    contactId?: string;
    price?: number;
    status?: SlotStatus;
  },
): Promise<Slot> {
  const tenantId = opts.tenantId ?? TENANT_A;

  return asTenant(orm, tenantId, async (em) => {
    const contact = opts.contactId
      ? em.getReference(Contact, opts.contactId)
      : em.create(Contact, {
          firstName: 'Raw',
          lastName: 'Fixture',
          email: null,
          phone: null,
          show: false,
        });

    const booking = em.create(Booking, { name: 'raw fixture', contact });

    const slot = em.create(Slot, {
      name: 'raw fixture',
      duration: formatTstzRange(opts.from, opts.to),
      price: String(opts.price ?? 100),
      pitch: opts.pitchId,
      booking,
      status: opts.status ?? SlotStatus.Booked,
    });
    await em.flush();

    return slot;
  });
}
