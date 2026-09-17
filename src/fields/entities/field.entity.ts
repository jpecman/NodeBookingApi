import { Collection, type Opt } from '@mikro-orm/core';
import { Entity, Filter, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { currentTenantOnCreate, TENANT_FILTER } from '../../common/tenancy/tenant.filter';
import { Pitch } from '../../pitches/entities/pitch.entity';

@Entity({ tableName: 'Fields' })
@Filter(TENANT_FILTER)
export class Field {
  /** No DB default — BookingApi generates ids app-side, so create() must call randomUUID(). */
  @PrimaryKey({ fieldName: 'Id', type: 'uuid' })
  id: string;

  /** BookingApi leaves FieldDb.Name unconstrained (text-like), unlike ContactDb. */
  @Property({ fieldName: 'Name', type: 'string' })
  name: string;

  /**
   * MikroORM cascades persist by default, which mirrors CreateFieldRequest.ToDomain()
   * building a field and its pitches together — one flush writes both. Removals are
   * not cascaded (no Cascade.REMOVE / orphanRemoval), so they stay explicit.
   */
  @OneToMany(() => Pitch, (pitch) => pitch.field)
  pitches = new Collection<Pitch>(this);

  @Property({ fieldName: 'TenantId', type: 'uuid', onCreate: currentTenantOnCreate })
  tenantId: Opt<string>;
}
