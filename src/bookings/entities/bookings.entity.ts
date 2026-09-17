import { Collection, type Opt, type Ref } from '@mikro-orm/core';
import {
  Entity,
  Filter,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { currentTenantOnCreate, TENANT_FILTER } from '../../common/tenancy/tenant.filter';
import { Contact } from '../../contacts/entities/contact.entity';
import { Slot } from '../../slots/entities/slot.entity';

/**
 * Maps onto BookingApi's own "Bookings" table (shared BookingDb on nunicek-ts), not a
 * table NodeBookingApi owns or migrates — same arrangement as Contact. Column names and
 * casing mirror BookingDb exactly.
 *
 * BookingDb's [Timestamp] uint Version is deliberately absent: EF maps it to Postgres's
 * xmin system column, which isn't mapped here. Concurrent updates through this API can
 * therefore overwrite each other silently.
 */
@Entity({ tableName: 'Bookings' })
@Filter(TENANT_FILTER)
export class Booking {
  /** No DB default — BookingApi generates ids app-side, so create() must call randomUUID(). */
  @PrimaryKey({ fieldName: 'Id', type: 'uuid' })
  id: string;

  @Property({ fieldName: 'Name', type: 'text' })
  name: string;

  /**
   * ON DELETE CASCADE is inherited DB behaviour; `deleteRule` just documents it. No
   * inverse collection on Contact: nothing needs it yet. `booking.contact.id` is readable
   * without loading the contact.
   */
  @ManyToOne(() => Contact, { fieldName: 'ContactId', ref: true, deleteRule: 'cascade' })
  contact: Ref<Contact>;

  /**
   * Slots.BookingId cascades on delete in the shared schema. The default persist cascade
   * means slots added to a new booking are inserted by the same flush.
   */
  @OneToMany(() => Slot, (slot) => slot.booking)
  slots = new Collection<Slot>(this);

  /**
   * BookingApi is multi-tenant; NodeBookingApi only ever operates against one real
   * tenant (see common/constants/tenant.ts). Filled on insert by onCreate and filtered on
   * read by TENANT_FILTER, both sourced from the request's JWT.
   */
  @Property({ fieldName: 'TenantId', type: 'uuid', onCreate: currentTenantOnCreate })
  tenantId: Opt<string>;
}
