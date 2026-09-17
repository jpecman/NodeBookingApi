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

@Entity({ tableName: 'Pitches' })
@Filter(TENANT_FILTER)
export class Pitch {
  /** No DB default — BookingApi generates ids app-side. */
  @PrimaryKey({ fieldName: 'Id', type: 'uuid' })
  id: string;

  @Property({ fieldName: 'Name', type: 'string' })
  name: string;

  /**
   * PitchDb marks FieldId [Required], which in EF implies cascade delete — deleting a
   * field takes its pitches with it. `deleteRule` only documents that for the schema
   * generator; the cascade itself is the DB's. `pitch.field.id` is readable without
   * loading the field.
   */
  @ManyToOne(() => Field, { fieldName: 'FieldId', ref: true, deleteRule: 'cascade' })
  @Index({ name: 'ix_pitches_field_id' })
  field: Ref<Field>;

  @Property({ fieldName: 'TenantId', type: 'uuid', onCreate: currentTenantOnCreate })
  tenantId: Opt<string>;
}
