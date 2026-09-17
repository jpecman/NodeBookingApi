import type { Opt } from '@mikro-orm/core';
import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { currentTenantOnCreate, TENANT_FILTER } from '../../common/tenancy/tenant.filter';

/**
 * Maps onto BookingApi's own "Contacts" table (shared BookingDb on nunicek-ts), not a
 * table NodeBookingApi owns or migrates. Column names/casing, NOT NULL-ness, and the
 * lack of created_at/updated_at/version all mirror BookingApiDbContext exactly.
 */
@Entity({ tableName: 'Contacts' })
@Filter(TENANT_FILTER)
export class Contact {
  /** No DB default — BookingApi generates ids app-side, so create() must call randomUUID(). */
  @PrimaryKey({ fieldName: 'Id', type: 'uuid' })
  id: string;

  @Property({ fieldName: 'FirstName', type: 'string', length: 30 })
  firstName: string;

  @Property({ fieldName: 'LastName', type: 'string', length: 30 })
  lastName: string;

  /** BookingApi encodes "no email" as '' (NOT NULL column), not NULL. */
  @Property({ fieldName: 'Email', type: 'string', length: 50 })
  email: string;

  /** Same '' convention as email. */
  @Property({ fieldName: 'Phone', type: 'string', length: 20 })
  phone: string;

  @Property({ fieldName: 'Show', type: 'boolean', default: false })
  show: boolean;

  /**
   * BookingApi is multi-tenant; NodeBookingApi only ever operates against one real
   * tenant (see common/constants/tenant.ts). Filled on insert by onCreate and filtered on
   * read by TENANT_FILTER, both sourced from the request's JWT.
   */
  @Property({ fieldName: 'TenantId', type: 'uuid', onCreate: currentTenantOnCreate })
  tenantId: Opt<string>;
}
