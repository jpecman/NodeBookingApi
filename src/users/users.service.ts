import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
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
    @InjectRepository(User)
    private readonly users: EntityRepository<User>,
    private readonly em: EntityManager,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ id });
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = this.users.create(input);
    await this.em.flush();
    return user;
  }

  /**
   * A user loaded in this request is already tracked, so persist() changes nothing for it;
   * flush() writes only the columns that changed.
   */
  async save(user: User): Promise<User> {
    await this.em.persist(user).flush();
    return user;
  }
}
