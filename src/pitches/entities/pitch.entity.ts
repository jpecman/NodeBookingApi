import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Field } from '../../fields/entities/field.entity';

@Entity('pitches')
export class Pitch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'field_id', type: 'uuid' })
  @Index('ix_pitches_field_id')
  fieldId: string;

  /**
   * PitchDb marks FieldId [Required], which in EF implies cascade delete — deleting a
   * field takes its pitches with it. Spelled out here because TypeORM defaults to NO
   * ACTION instead.
   */
  @ManyToOne(() => Field, (field) => field.pitches, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'field_id' })
  field: Field;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
