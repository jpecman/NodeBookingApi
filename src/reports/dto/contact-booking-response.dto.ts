import { ApiProperty } from '@nestjs/swagger';
import { ContactResponseDto } from '../../contacts/dto/contact-response.dto';
import { SlotStatus } from '../../slots/slot-status.enum';

/**
 * One contact's bookings within the reported window, aggregated. Mirrors BookingApi's
 * ContactBookingSummaryResponse — the field names are what BookingWeb's OverviewPage
 * already reads.
 */
export class ContactBookingResponseDto {
  @ApiProperty({ type: ContactResponseDto })
  contact: ContactResponseDto;

  @ApiProperty({ example: 12 })
  bookingCount: number;

  /**
   * Sum of the counted slots' prices. Slot.price is pg numeric, so it arrives as a string —
   * the service adds them up and converts, the same way SlotResponseDto does per slot.
   */
  @ApiProperty({ example: 14400 })
  totalPrice: number;

  /** Earliest slot start across the contact's bookings (BookingApi: min of Booking.From). */
  @ApiProperty({ type: String, format: 'date-time' })
  earliestBookingDate: Date;

  /** Latest slot end across the contact's bookings (BookingApi: max of Booking.To). */
  @ApiProperty({ type: String, format: 'date-time' })
  latestBookingDate: Date;

  /**
   * The least-progressed status across the counted slots — min of the enum, so a single
   * unpaid slot keeps the whole row at Booked. Integer on the wire, as in SlotResponseDto.
   */
  @ApiProperty({ enum: SlotStatus, enumName: 'SlotStatus' })
  status: SlotStatus;
}
