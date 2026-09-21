import { randomUUID } from 'crypto';
import { Collection, type Opt } from '@mikro-orm/core';
import { Entity, Filter, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { currentTenantOnCreate, TENANT_FILTER } from '../../common/tenancy/tenant.filter';
import { Pitch } from '../../pitches/entities/pitch.entity';

/** NodeBookingApi-owned table, created by the InitBookingSchema migration. */
@Entity({ tableName: 'fields' })
@Filter(TENANT_FILTER)
export class Field {
  @PrimaryKey({ fieldName: 'id', type: 'uuid' })
  id: Opt<string> = randomUUID();

  @Property({ fieldName: 'name', type: 'text' })
  name: string;

  /**
   * MikroORM cascades persist by default, so one flush writes a field and the pitches
   * created with it. Removals are not cascaded (no Cascade.REMOVE / orphanRemoval), so
   * they stay explicit.
   */
  @OneToMany(() => Pitch, (pitch) => pitch.field)
  pitches = new Collection<Pitch>(this);

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
