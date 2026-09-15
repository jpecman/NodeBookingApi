import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Field } from '../../fields/entities/field.entity';

@Entity('Pitches')
export class Pitch {
  @PrimaryColumn({ name: 'Id', type: 'uuid'})
  id: string;

  @Column({ name: 'Name', type: 'varchar'})
  name: string;

  @Column({ name: 'FieldId', type: 'uuid' })
  @Index('ix_pitches_field_id')
  fieldId: string;

  /**
   * PitchDb marks FieldId [Required], which in EF implies cascade delete — deleting a
   * field takes its pitches with it. Spelled out here because TypeORM defaults to NO
   * ACTION instead.
   */
  @ManyToOne(() => Field, (field) => field.pitches, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'FieldId' })
  field: Field;

  @Column({ name: 'TenantId', type: 'uuid' })
  tenantId: string;
}
