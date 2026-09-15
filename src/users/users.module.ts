import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUTH_CONNECTION } from '../database/auth-database.module';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User], AUTH_CONNECTION)],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
