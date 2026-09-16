import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Booking } from '../../bookings/entities/bookings.entity';
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
 * generic 500 — it only special-cases 23505.
 *
 * BookingDb's [Timestamp] uint Version is deliberately absent: EF maps it to Postgres's
 * xmin system column, which TypeORM has no equivalent for.
 */
@Entity('Slots')
export class Slot {
  /** No DB default — BookingApi generates ids app-side, so create() must call randomUUID(). */
  @PrimaryColumn({ name: 'Id', type: 'uuid' })
  id: string;

  @Column({ name: 'Name', type: 'text' })
  name: string;

  /**
   * NpgsqlRange<DateTime> on the .NET side. node-postgres registers no parser for
   * tstzrange, so the value arrives and leaves as a raw range literal:
   *   ["2026-09-14 18:00:00+00","2026-09-14 19:00:00+00")
   * Lower bound inclusive, upper bound exclusive — see SlotExtensions.ToEntity().
   * Parsing and formatting belong at the DTO boundary.
   */
  @Column({ name: 'Duration', type: 'tstzrange' })
  duration: string;

  /**
   * numeric. pg returns it as a string rather than a float to preserve precision, and
   * TypeORM passes that through untouched — convert at the DTO boundary, not here.
   */
  @Column({ name: 'Price', type: 'numeric' })
  price: string;

  @Column({ name: 'PitchId', type: 'uuid' })
  pitchId: string;

  /**
   * ON DELETE CASCADE is inherited DB behaviour, spelled out because TypeORM defaults to
   * NO ACTION. No inverse property on Pitch: nothing needs to load slots from a pitch yet.
   */
  @ManyToOne(() => Pitch, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'PitchId' })
  pitch: Pitch;

  @Column({ name: 'BookingId', type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.slots, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'BookingId' })
  booking: Booking;

  /** Plain integer column, not a Postgres enum type. Defaults to Booked on the .NET side. */
  @Column({ name: 'Status', type: 'integer' })
  status: SlotStatus;

  /** The one genuinely nullable column on this table. */
  @Column({ name: 'CancellationReason', type: 'text', nullable: true })
  cancellationReason: string | null;

  /**
   * BookingApi is multi-tenant; NodeBookingApi only ever operates against one real
   * tenant (see common/constants/tenant.ts). Stamped on insert by TenantSubscriber and
   * filtered on read via getCurrentTenantId(), both sourced from the request's JWT.
   */
  @Column({ name: 'TenantId', type: 'uuid' })
  tenantId: string;
}
