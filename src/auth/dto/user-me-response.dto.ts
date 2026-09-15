import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/user-role.enum';
import { AuthenticatedUser } from '../types/authenticated-user';

export class UserMeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  static fromAuthenticatedUser(user: AuthenticatedUser): UserMeResponseDto {
    return { id: user.id, email: user.email, role: user.role };
  }
}
