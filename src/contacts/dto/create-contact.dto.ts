import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ maxLength: 30, example: 'Jan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  firstName: string;

  @ApiProperty({ maxLength: 30, example: 'Novák' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  lastName: string;

  @ApiPropertyOptional({ maxLength: 50, example: 'jan.novak@example.com', nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(50)
  email?: string | null;

  @ApiPropertyOptional({ maxLength: 20, example: '777123456', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @ApiPropertyOptional({
    default: false,
    description: 'Whether to surface this contact in the UI.',
  })
  @IsOptional()
  @IsBoolean()
  show?: boolean;
}
