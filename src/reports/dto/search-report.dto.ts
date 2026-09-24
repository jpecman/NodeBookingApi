import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate } from 'class-validator';
import { IsNotBefore } from '../../common/validators/is-not-before.validator';

/**
 * The window a report covers. Mirrors BookingApi's ContactBookingSummaryRequest, which is
 * a BookingSearch with includeCancelled fixed to false and no contact filter — so unlike
 * SearchBookingsDto there is nothing else to pass.
 */
export class SearchReportsDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  from: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  @IsNotBefore('from')
  to: Date;
}
