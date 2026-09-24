import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ContactBookingResponseDto } from './dto/contact-booking-response.dto';

/**
 * OpenAPI documentation for ReportsController, kept out of the controller so its routes
 * stay readable. Each export bundles one target's decorators via applyDecorators.
 */

/** Class-level: every route here sits behind the global JwtAuthGuard. */
export const ApiReportsController = () =>
  applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Missing or invalid session cookie',
      type: ErrorResponseDto,
    }),
  );

export const ApiContactBookingsReport = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Bookings per contact for a date range',
      description:
        'Counts only non-cancelled slots lying entirely within the range. `status` is the ' +
        'least-progressed status among them, so one unpaid slot keeps the row at Booked.',
    }),
    ApiOkResponse({ type: [ContactBookingResponseDto] }),
    ApiBadRequestResponse({
      description: 'from/to missing or not dates, to before from, or an unknown query parameter',
      type: ErrorResponseDto,
    }),
  );
