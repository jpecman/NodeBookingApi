import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  /** Matches ASP.NET Identity's default minimum length, kept for parity with BookingApi. */
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  newPassword: string;
}
