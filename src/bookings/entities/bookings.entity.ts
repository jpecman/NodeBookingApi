import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { Contact } from '../../contacts/entities/contact.entity';
import { Slot } from '../../slots/entities/slot.entity';

/**
 * Maps onto BookingApi's own "Bookings" table (shared BookingDb on nunicek-ts), not a
 * table NodeBookingApi owns or migrates — same arrangement as Contact. Column names and
 * casing mirror BookingDb exactly.
 *
 * BookingDb's [Timestamp] uint Version is deliberately absent: EF maps it to Postgres's
 * xmin system column, which TypeORM has no equivalent for. Concurrent updates through
 * this API can therefore overwrite each other silently.
 */
@Entity('Bookings')
export class Booking {
  /** No DB default — BookingApi generates ids app-side, so create() must call randomUUID(). */
  @PrimaryColumn({ name: 'Id', type: 'uuid' })
  id: string;

  @Column({ name: 'Name', type: 'text' })
  name: string;

  @Column({ name: 'ContactId', type: 'uuid' })
  contactId: string;

  /**
   * ON DELETE CASCADE is inherited DB behaviour, spelled out here because TypeORM
   * defaults to NO ACTION. No inverse property on Contact: adding one would mean editing
   * an entity that mirrors ContactDb field for field, and nothing needs it yet.
   */
  @ManyToOne(() => Contact, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'ContactId' })
  contact: Contact;

  /**
   * Slots.BookingId cascades on delete in the shared schema. Read-only here: no cascade
   * option, so slots are never written through a booking.
   */
  @OneToMany(() => Slot, (slot) => slot.booking)
  slots: Slot[];

  /**
   * BookingApi is multi-tenant; NodeBookingApi only ever operates against one real
   * tenant (see common/constants/tenant.ts). Stamped on insert by TenantSubscriber and
   * filtered on read via getCurrentTenantId(), both sourced from the request's JWT.
   */
  @Column({ name: 'TenantId', type: 'uuid' })
  tenantId: string;
}
