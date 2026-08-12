import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFieldDto {
  @ApiProperty({ maxLength: 100, example: 'North Field' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /**
   * Bare names, not objects — CreateFieldRequest takes IReadOnlyList<string> and
   * builds the Pitch records itself. An empty array is a field with no pitches yet.
   * `{ each: true }` applies the validator per element.
   */
  @ApiProperty({
    type: [String],
    example: ['Pitch A', 'Pitch B'],
    description: 'Names of the pitches to create alongside the field.',
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  pitches: string[];
}
