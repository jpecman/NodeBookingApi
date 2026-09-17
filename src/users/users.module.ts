import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AUTH_CONTEXT } from '../database/mikro-orm.options';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [MikroOrmModule.forFeature([User], AUTH_CONTEXT)],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
