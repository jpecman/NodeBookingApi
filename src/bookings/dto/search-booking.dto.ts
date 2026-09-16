import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsUUID } from 'class-validator';

export class SearchBookingsDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  from: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  to: Date;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true' || obj[key] === true)
  @IsBoolean()
  includeCancelled: boolean = false;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}
