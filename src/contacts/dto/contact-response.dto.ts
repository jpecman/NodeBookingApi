import { ApiProperty } from '@nestjs/swagger';
import { Contact } from '../entities/contact.entity';

export class ContactResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Jan' })
  firstName: string;

  @ApiProperty({ example: 'Novák' })
  lastName: string;

  @ApiProperty({ type: String, nullable: true, example: 'jan.novak@example.com' })
  email: string | null;

  @ApiProperty({ type: String, nullable: true, example: '777123456' })
  phone: string | null;

  @ApiProperty()
  show: boolean;

  static fromEntity(contact: Contact): ContactResponseDto {
    return {
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      show: contact.show,
    };
  }
}
