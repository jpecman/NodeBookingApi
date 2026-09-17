import { ApiProperty } from '@nestjs/swagger';
import { ContactResponseDto } from '../../contacts/dto/contact-response.dto';
import { Slot } from '../../slots/entities/slot.entity';
import { SlotStatus } from '../../slots/slot-status.enum';
import { parseTstzRange } from '../../slots/tstzrange';
import { Booking } from '../entities/bookings.entity';

/**
 * Mirrors BookingApi's SlotResponse. Lives here only because nothing else reads slots
 * yet — it belongs in slots/dto/ once a slots endpoint exists.
 */
export class SlotResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Monday evening' })
  name: string;

  /** Inclusive lower bound of the stored Duration range. */
  @ApiProperty({ type: String, format: 'date-time' })
  from: Date;

  /** Exclusive upper bound of the stored Duration range. */
  @ApiProperty({ type: String, format: 'date-time' })
  to: Date;

  @ApiProperty({ example: 1200 })
  price: number;

  @ApiProperty({ format: 'uuid' })
  pitchId: string;

  @ApiProperty({ format: 'uuid' })
  bookingId: string;

  /** Integer on the wire, as BookingApi registers no JsonStringEnumConverter. */
  @ApiProperty({ enum: SlotStatus, enumName: 'SlotStatus' })
  status: SlotStatus;

  @ApiProperty({ type: String, nullable: true })
  cancellationReason: string | null;

  /**
   * The entity keeps Duration as the raw range literal and Price as pg's numeric string;
   * this is where both become the types BookingApi's contract promises. Number() is safe
   * for prices — the precision it gives up is far beyond any real amount.
   */
  static fromEntity(slot: Slot): SlotResponseDto {
    const { from, to } = parseTstzRange(slot.duration);

    return {
      id: slot.id,
      name: slot.name,
      from,
      to,
      price: Number(slot.price),
      // References know their target's id without being loaded.
      pitchId: slot.pitch.id,
      bookingId: slot.booking.id,
      status: slot.status,
      cancellationReason: slot.cancellationReason,
    };
  }
}

/** Mirrors BookingApi's BookingResponse(Id, Name, Contact, Slots). */
export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Weekly training' })
  name: string;

  @ApiProperty({ type: ContactResponseDto })
  contact: ContactResponseDto;

  @ApiProperty({ type: [SlotResponseDto] })
  slots: SlotResponseDto[];

  /**
   * Requires the query to populate `contact` — it's non-optional in the contract, so
   * there is no sensible fallback, and getEntity() throws if it wasn't loaded. `slots`
   * falls back to [] the same way FieldResponseDto treats `pitches`, since reading an
   * unpopulated collection throws.
   */
  static fromEntity(booking: Booking): BookingResponseDto {
    return {
      id: booking.id,
      name: booking.name,
      contact: ContactResponseDto.fromEntity(booking.contact.getEntity()),
      slots: booking.slots.isInitialized()
        ? booking.slots.getItems().map(SlotResponseDto.fromEntity)
        : [],
    };
  }
}
