import { randomUUID } from 'crypto';
import type { Opt, Ref } from '@mikro-orm/core';
import {
  Entity,
  Filter,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { currentTenantOnCreate, TENANT_FILTER } from '../../common/tenancy/tenant.filter';
import { Field } from '../../fields/entities/field.entity';

/** NodeBookingApi-owned table, created by the InitBookingSchema migration. */
@Entity({ tableName: 'pitches' })
@Filter(TENANT_FILTER)
export class Pitch {
  @PrimaryKey({ fieldName: 'id', type: 'uuid' })
  id: Opt<string> = randomUUID();

  @Property({ fieldName: 'name', type: 'text' })
  name: string;

  /**
   * Deleting a field takes its pitches with it — the cascade is the database's, declared
   * by the migration; `deleteRule` documents it here. `pitch.field.id` is readable without
   * loading the field.
   */
  @ManyToOne(() => Field, { fieldName: 'field_id', ref: true, deleteRule: 'cascade' })
  @Index({ name: 'ix_pitches_field_id' })
  field: Ref<Field>;

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
