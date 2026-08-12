import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePitchDto } from './create-pitch.dto';

/**
 * UpdatePitchRequest is Name only — omitting `fieldId` means a pitch cannot be
 * reassigned to a different field through an update, matching BookingApi.
 */
export class UpdatePitchDto extends PartialType(OmitType(CreatePitchDto, ['fieldId'] as const)) {}
