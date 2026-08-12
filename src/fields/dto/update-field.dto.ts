import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFieldDto } from './create-field.dto';

/**
 * UpdateFieldRequest carries only Name — pitches are managed through their own
 * endpoints, not by replacing the collection on a field update. OmitType drops
 * `pitches` before PartialType makes what remains optional, so a stray `pitches`
 * key is a 400 rather than a silently ignored one.
 */
export class UpdateFieldDto extends PartialType(OmitType(CreateFieldDto, ['pitches'] as const)) {}
