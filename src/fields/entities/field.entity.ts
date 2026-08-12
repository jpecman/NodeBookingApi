import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Pitch } from '../../pitches/entities/pitch.entity';

@Entity('fields')
export class Field {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * BookingApi leaves FieldDb.Name unconstrained — only ContactDb and TenantDb get
   * explicit lengths. 100 matches TenantDb.Name and keeps this project's habit of
   * stating a length on every varchar.
   */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /**
   * cascade: ['insert'] mirrors CreateFieldRequest.ToDomain(), which builds a field
   * and its pitches together — so one save(field) persists both. Deliberately not
   * `true`: removals should stay explicit.
   */
  @OneToMany(() => Pitch, (pitch) => pitch.field, { cascade: ['insert'] })
  pitches: Pitch[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /** Optimistic concurrency token — stands in for FieldDb's [Timestamp] uint. */
  @VersionColumn()
  version: number;
}
