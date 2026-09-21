import { randomUUID } from 'crypto';
import type { Opt } from '@mikro-orm/core';
import { Entity, Filter, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { currentTenantOnCreate, TENANT_FILTER } from '../../common/tenancy/tenant.filter';

/**
 * NodeBookingApi-owned table, created by the InitBookingSchema migration — snake_case
 * columns, like users in the auth database.
 *
 * email and phone are genuinely nullable: NULL means "none". The unique index on
 * (tenant_id, email) still allows any number of contacts without one, because Postgres
 * treats NULLs as distinct.
 */
@Entity({ tableName: 'contacts' })
@Filter(TENANT_FILTER)
export class Contact {
  /**
   * The column defaults to gen_random_uuid(), but the initializer means the id exists
   * before the insert. Initializers only run for em.create()/new — loaded rows are
   * hydrated without them.
   */
  @PrimaryKey({ fieldName: 'id', type: 'uuid' })
  id: Opt<string> = randomUUID();

  @Property({ fieldName: 'first_name', type: 'string', length: 30 })
  firstName: string;

  @Property({ fieldName: 'last_name', type: 'string', length: 30 })
  lastName: string;

  @Property({ fieldName: 'email', type: 'string', length: 50, nullable: true })
  email: string | null;

  @Property({ fieldName: 'phone', type: 'string', length: 20, nullable: true })
  phone: string | null;

  @Property({ fieldName: 'show', type: 'boolean', default: false })
  show: boolean;

  /**
   * The app only ever operates against one tenant (common/constants/tenant.ts). Filled on
   * insert by onCreate and filtered on read by TENANT_FILTER, both sourced from the
   * request's JWT. Not a foreign key: there is no tenants table, same as users.tenant_id.
   */
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
