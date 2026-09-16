import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { BookingResponseDto } from './dto/booking-response.dto';

/**
 * OpenAPI documentation for BookingsController, kept out of the controller so its routes
 * stay readable. Each export bundles one target's decorators via applyDecorators.
 */

/** Class-level: every route here sits behind the global JwtAuthGuard. */
export const ApiBookingsController = () =>
  applyDecorators(
    ApiUnauthorizedResponse({
      description: 'Missing or invalid session cookie',
      type: ErrorResponseDto,
    }),
  );

export const ApiSearchBookings = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Search bookings by slot time range',
      description: "Each booking's slots are limited to the ones matching the search.",
    }),
    ApiOkResponse({ type: [BookingResponseDto] }),
    ApiBadRequestResponse({
      description: 'from/to missing or not dates, or an unknown query parameter',
      type: ErrorResponseDto,
    }),
  );

export const ApiCreateBooking = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Create a booking',
      description:
        'Creates one session, or one per week from `from` until `endDate` (at most 52), ' +
        'and assigns each session a pitch — or every pitch when `isWholeField` is set.',
    }),
    ApiCreatedResponse({ type: BookingResponseDto }),
    ApiBadRequestResponse({
      description:
        'Validation failed, the series ends before it starts or is too long, the start time ' +
        "doesn't exist on a DST-change day, or the field has no pitches",
      type: ErrorResponseDto,
    }),
    ApiNotFoundResponse({ description: 'Contact or field not found', type: ErrorResponseDto }),
    ApiConflictResponse({
      description: 'A session overlaps an existing booking on the field',
      type: ErrorResponseDto,
    }),
  );
