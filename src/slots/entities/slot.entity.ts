import { randomUUID } from 'crypto';
import type { Opt, Ref } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { Booking } from '../../bookings/entities/bookings.entity';
import { currentTenantOnCreate, TENANT_FILTER } from '../../common/tenancy/tenant.filter';
import { Pitch } from '../../pitches/entities/pitch.entity';
import { SlotStatus } from '../slot-status.enum';

/**
 * NodeBookingApi-owned table, created by the InitBookingSchema migration.
 *
 * That migration also adds an exclusion constraint:
 *   EXCLUDE USING gist (pitch_id WITH =, duration WITH &&) WHERE (status <> 3)
 * so two non-cancelled slots can never overlap on one pitch, whatever the application's
 * own checks do under concurrency. Violating it raises SQLSTATE 23P01
 * (exclusion_violation), which AllExceptionsFilter currently maps to a generic 500 — it
 * only special-cases unique violations.
 */
@Entity({ tableName: 'slots' })
@Filter(TENANT_FILTER)
export class Slot {
  @PrimaryKey({ fieldName: 'id', type: 'uuid' })
  id: Opt<string> = randomUUID();

  @Property({ fieldName: 'name', type: 'text' })
  name: string;

  /**
   * No type is registered for tstzrange, so the value arrives and leaves as a raw range
   * literal:
   *   ["2026-09-14 18:00:00+00","2026-09-14 19:00:00+00")
   * Lower bound inclusive, upper bound exclusive — see slots/tstzrange.ts.
   */
  @Property({ fieldName: 'duration', type: 'string', columnType: 'tstzrange' })
  duration: string;

  /**
   * numeric. MikroORM's decimal type keeps it as a string to preserve precision —
   * convert at the DTO boundary, not here.
   */
  @Property({ fieldName: 'price', type: 'decimal', columnType: 'numeric' })
  price: string;

  /** Deleting a pitch deletes its slots; the cascade is the database's. */
  @ManyToOne(() => Pitch, { fieldName: 'pitch_id', ref: true, deleteRule: 'cascade' })
  pitch: Ref<Pitch>;

  @ManyToOne(() => Booking, { fieldName: 'booking_id', ref: true, deleteRule: 'cascade' })
  booking: Ref<Booking>;

  /** Plain integer column, not a Postgres enum type — the exclusion constraint reads it. */
  @Enum({ fieldName: 'status', items: () => SlotStatus, type: 'integer' })
  status: SlotStatus;

  @Property({ fieldName: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null = null;

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
