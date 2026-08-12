import { ApiProperty } from '@nestjs/swagger';
import { Pitch } from '../entities/pitch.entity';

/**
 * Mirrors BookingApi's PitchResponse(Guid Id, string Name) — deliberately minimal,
 * since this is mostly read nested inside a field. Keeps `fieldId` and the timestamps
 * off the wire; the parent field already establishes the relationship.
 */
export class PitchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Pitch A' })
  name: string;

  static fromEntity(pitch: Pitch): PitchResponseDto {
    return {
      id: pitch.id,
      name: pitch.name,
    };
  }
}
