import { PartialType } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';

/**
 * Every field optional, validators inherited. PartialType comes from @nestjs/swagger
 * (not @nestjs/mapped-types) so the OpenAPI metadata carries over too.
 */
export class UpdateContactDto extends PartialType(CreateContactDto) {}
