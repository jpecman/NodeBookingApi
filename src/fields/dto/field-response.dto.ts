import { ApiProperty } from '@nestjs/swagger';
import { PitchResponseDto } from '../../pitches/dto/pitch-response.dto';
import { Field } from '../entities/field.entity';

export class FieldResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ maxLength: 100, example: 'North Field' })
  name: string;

  @ApiProperty({ type: [PitchResponseDto] })
  pitches: PitchResponseDto[];

  // @ApiProperty()
  // createdAt: Date;

  // @ApiProperty()
  // updatedAt: Date;

  /** Keeps the persistence shape (`version`) from leaking onto the wire. */
  static fromEntity(field: Field): FieldResponseDto {
    return {
      id: field.id,
      name: field.name,
      // Reading an unpopulated collection throws, so the isInitialized() check is what
      // stops a plain find() without `populate` from turning this into a 500.
      pitches: field.pitches.isInitialized()
        ? field.pitches.getItems().map(PitchResponseDto.fromEntity)
        : [],
      // createdAt: field.createdAt,
      // updatedAt: field.updatedAt,
    };
  }
}
