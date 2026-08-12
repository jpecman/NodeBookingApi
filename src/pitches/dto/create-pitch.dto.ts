import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePitchDto {
  /** CreatePitchRequest carries the FieldId in the body rather than the route. */
  @ApiProperty({ format: 'uuid', example: '6f9d3f1e-0000-4000-8000-000000000000' })
  @IsUUID()
  fieldId: string;

  @ApiProperty({ maxLength: 100, example: 'Pitch A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
