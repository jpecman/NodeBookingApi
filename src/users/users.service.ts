import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AUTH_CONNECTION } from '../database/auth-database.module';
import { User } from './entities/user.entity';
import { UserRole } from './user-role.enum';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  role: UserRole;
  tenantId: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User, AUTH_CONNECTION)
    private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = this.users.create(input);
    return this.users.save(user);
  }

  async save(user: User): Promise<User> {
    return this.users.save(user);
  }
}
