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

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  /** Keeps the persistence shape (`version`) from leaking onto the wire. */
  static fromEntity(field: Field): FieldResponseDto {
    return {
      id: field.id,
      name: field.name,
      // TypeORM leaves `pitches` undefined unless the query asked for the relation,
      // so `?? []` is what stops a plain find() from turning this into a 500.
      pitches: (field.pitches ?? []).map(PitchResponseDto.fromEntity),
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    };
  }
}
