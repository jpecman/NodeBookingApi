import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { createOrmOptions } from './mikro-orm.options';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      driver: PostgreSqlDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...createOrmOptions({
          clientUrl: config.getOrThrow<string>('database.url'),
          debug: config.get<string>('nodeEnv') === 'development',
        }),
        // Entities come from every MikroOrmModule.forFeature([...]).
        autoLoadEntities: true,
        // registerRequestContext defaults to true: the module installs MikroOrmMiddleware
        // itself, forking the EntityManager per request. Only multiple named contexts
        // would need MikroOrmModule.forMiddleware() in AppModule.
      }),
    }),
  ],
})
export class DatabaseModule {}
