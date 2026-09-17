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
 * Maps onto BookingApi's own "Slots" table (shared BookingDb on nunicek-ts), not a table
 * NodeBookingApi owns or migrates — same arrangement as Contact and Booking.
 *
 * The table carries an exclusion constraint BookingApi added by hand:
 *   EXCLUDE USING gist ("PitchId" WITH =, "Duration" WITH &&) WHERE ("Status" != 3)
 * so two non-cancelled slots on one pitch can never overlap in time. Violating it raises
 * SQLSTATE 23P01 (exclusion_violation), which AllExceptionsFilter currently maps to a
 * generic 500 — it only special-cases unique violations.
 *
 * BookingDb's [Timestamp] uint Version is deliberately absent: EF maps it to Postgres's
 * xmin system column, which isn't mapped here.
 */
@Entity({ tableName: 'Slots' })
@Filter(TENANT_FILTER)
export class Slot {
  /** No DB default — BookingApi generates ids app-side, so create() must call randomUUID(). */
  @PrimaryKey({ fieldName: 'Id', type: 'uuid' })
  id: string;

  @Property({ fieldName: 'Name', type: 'text' })
  name: string;

  /**
   * NpgsqlRange<DateTime> on the .NET side. No type is registered for tstzrange, so the
   * value arrives and leaves as a raw range literal:
   *   ["2026-09-14 18:00:00+00","2026-09-14 19:00:00+00")
   * Lower bound inclusive, upper bound exclusive — see slots/tstzrange.ts.
   */
  @Property({ fieldName: 'Duration', type: 'string', columnType: 'tstzrange' })
  duration: string;

  /**
   * numeric. MikroORM's decimal type keeps it as a string to preserve precision —
   * convert at the DTO boundary, not here.
   */
  @Property({ fieldName: 'Price', type: 'decimal', columnType: 'numeric' })
  price: string;

  /** ON DELETE CASCADE is inherited DB behaviour. No inverse collection on Pitch. */
  @ManyToOne(() => Pitch, { fieldName: 'PitchId', ref: true, deleteRule: 'cascade' })
  pitch: Ref<Pitch>;

  @ManyToOne(() => Booking, { fieldName: 'BookingId', ref: true, deleteRule: 'cascade' })
  booking: Ref<Booking>;

  /** Plain integer column, not a Postgres enum type. Defaults to Booked on the .NET side. */
  @Enum({ fieldName: 'Status', items: () => SlotStatus, type: 'integer' })
  status: SlotStatus;

  /** The one genuinely nullable column on this table. */
  @Property({ fieldName: 'CancellationReason', type: 'text', nullable: true })
  cancellationReason: string | null = null;

  /**
   * BookingApi is multi-tenant; NodeBookingApi only ever operates against one real
   * tenant (see common/constants/tenant.ts). Filled on insert by onCreate and filtered on
   * read by TENANT_FILTER, both sourced from the request's JWT.
   */
  @Property({ fieldName: 'TenantId', type: 'uuid', onCreate: currentTenantOnCreate })
  tenantId: Opt<string>;
}
