import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Mirrors BookingApi's BookingDuration: session length in minutes, sent as a plain
 * integer. Only these three lengths exist.
 */
export enum BookingDuration {
  OneHour = 60,
  OneAndHalfHour = 90,
  TwoHours = 120,
}

/**
 * Mirrors BookingApi's BookingRequest. This describes a *recurrence*, not a list of slots:
 * the server expands it into one session per week from `from` until `endDate`, then
 * decides which pitches each session occupies.
 */
export class CreateBookingDto {
  /** Free text, unconstrained like BookingDb.Name (a text column). */
  @ApiProperty({ example: 'Weekly training' })
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Start of the first session; its time of day is reused for every following week. */
  @ApiProperty({ type: String, format: 'date-time', example: '2026-09-21T18:00:00Z' })
  @Type(() => Date)
  @IsDate()
  from: Date;

  @ApiProperty({ enum: BookingDuration, enumName: 'BookingDuration', example: 90 })
  @IsEnum(BookingDuration)
  duration: BookingDuration;

  /**
   * Price per session. BookingApi accepts any decimal; rejecting negatives is the one
   * rule added here.
   */
  @ApiProperty({ example: 1200 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  price: number;

  /** Book every pitch on the field rather than letting the server pick one. */
  @ApiProperty({ example: false })
  @IsBoolean()
  isWholeField: boolean;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  contactId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fieldId: string;

  /**
   * Last date of the weekly recurrence; only its date part is used. Omit or send null for
   * a single session.
   */
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date | null;
}
