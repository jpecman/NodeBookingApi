import { randomUUID } from 'crypto';
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

/** NodeBookingApi-owned table, created by the InitBookingSchema migration. */
@Entity({ tableName: 'bookings' })
@Filter(TENANT_FILTER)
export class Booking {
  @PrimaryKey({ fieldName: 'id', type: 'uuid' })
  id: Opt<string> = randomUUID();

  @Property({ fieldName: 'name', type: 'text' })
  name: string;

  /**
   * Deleting a contact deletes their bookings — the cascade is declared by the migration;
   * `deleteRule` documents it here. No inverse collection on Contact: nothing needs one
   * yet, and `booking.contact.id` is readable without loading the contact.
   */
  @ManyToOne(() => Contact, { fieldName: 'contact_id', ref: true, deleteRule: 'cascade' })
  contact: Ref<Contact>;

  /**
   * slots.booking_id cascades on delete. The default persist cascade means slots created
   * with a booking are inserted by the same flush.
   */
  @OneToMany(() => Slot, (slot) => slot.booking)
  slots = new Collection<Slot>(this);

  @Property({ fieldName: 'tenant_id', type: 'uuid', onCreate: currentTenantOnCreate })
  tenantId: Opt<string>;

  @Property({
    fieldName: 'created_at',
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
  })
  createdAt: Opt<Date> = new Date();

  @Property({
    fieldName: 'updated_at',
    type: 'datetime',
    columnType: 'timestamptz',
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();
}
