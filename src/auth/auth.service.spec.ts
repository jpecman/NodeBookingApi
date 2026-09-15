import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = { findByEmail: jest.fn(), findById: jest.fn(), save: jest.fn() };
  const jwtService = { sign: jest.fn() };
  let user: User;

  beforeEach(async () => {
    jest.resetAllMocks();

    user = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: await bcrypt.hash('correct-password', 4),
      role: UserRole.Administrator,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('validateUser', () => {
    it('returns the user when the password matches', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(service.validateUser(user.email, 'correct-password')).resolves.toBe(user);
    });

    it('throws UnauthorizedException when the password is wrong', async () => {
      usersService.findByEmail.mockResolvedValue(user);

      await expect(service.validateUser(user.email, 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser('nobody@example.com', 'whatever')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    it('throws UnauthorizedException when the current password is wrong', async () => {
      usersService.findById.mockResolvedValue(user);

      await expect(
        service.changePassword(user.id, 'wrong-password', 'new-password-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('saves a new hash when the current password matches', async () => {
      usersService.findById.mockResolvedValue(user);

      await service.changePassword(user.id, 'correct-password', 'new-password-123');

      expect(usersService.save).toHaveBeenCalledWith(expect.objectContaining({ id: user.id }));
      const savedUser = usersService.save.mock.calls[0][0] as User;
      await expect(bcrypt.compare('new-password-123', savedUser.passwordHash)).resolves.toBe(true);
    });
  });
});
