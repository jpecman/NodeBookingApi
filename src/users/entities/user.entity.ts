import { randomUUID } from 'crypto';
import type { Opt } from '@mikro-orm/core';
import { Entity, Enum, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { UserRole } from '../user-role.enum';

/**
 * tenant_id holds the same tenant GUID every other row is stamped with — see
 * common/constants/tenant.ts — so a logged-in user's tenant context matches the rows their
 * queries can see. Not a foreign key: there is no tenants table.
 *
 * Not tenant-filtered: login has to find the user before any tenant context exists.
 *
 * Property initializers only run for `new User()`/`em.create()`; MikroORM hydrates
 * loaded rows without calling them, so they act as insert-time defaults.
 */
@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ fieldName: 'id', type: 'uuid' })
  id: Opt<string> = randomUUID();

  @Property({ fieldName: 'email', type: 'string', unique: true })
  email: string;

  @Property({ fieldName: 'password_hash', type: 'string' })
  passwordHash: string;

  /** A native Postgres enum, created by the InitUsers migration. */
  @Enum({ fieldName: 'role', items: () => UserRole, nativeEnumName: 'users_role_enum' })
  role: UserRole;

  @Property({ fieldName: 'tenant_id', type: 'uuid' })
  tenantId: string;

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
