import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Maps onto BookingApi's own "Contacts" table (shared BookingDb on nunicek-ts), not a
 * table NodeBookingApi owns or migrates. Column names/casing, NOT NULL-ness, and the
 * lack of created_at/updated_at/version all mirror BookingApiDbContext exactly.
 */
@Entity('Contacts')
export class Contact {
  @PrimaryColumn({ name: 'Id', type: 'uuid' })
  id: string;

  @Column({ name: 'FirstName', type: 'varchar', length: 30 })
  firstName: string;

  @Column({ name: 'LastName', type: 'varchar', length: 30 })
  lastName: string;

  /** BookingApi encodes "no email" as '' (NOT NULL column), not NULL. */
  @Column({ name: 'Email', type: 'varchar', length: 50 })
  email: string;

  /** Same '' convention as email. */
  @Column({ name: 'Phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'Show', type: 'boolean', default: false })
  show: boolean;

  /**
   * BookingApi is multi-tenant; NodeBookingApi only ever operates against one real
   * tenant (see common/constants/tenant.ts). Stamped on insert by TenantSubscriber and
   * filtered on read via getCurrentTenantId(), both sourced from the request's JWT.
   */
  @Column({ name: 'TenantId', type: 'uuid' })
  tenantId: string;
}
