import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { AUTH_MIGRATIONS } from './migrations/auth';
import { AUTH_CONTEXT, createOrmOptions } from './mikro-orm.options';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      contextName: AUTH_CONTEXT,
      driver: PostgreSqlDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...createOrmOptions({
          clientUrl: config.getOrThrow<string>('authDatabase.url'),
          debug: config.get<string>('nodeEnv') === 'development',
          migrationsDir: 'migrations/auth',
          migrations: AUTH_MIGRATIONS,
        }),
        // Entities come from every MikroOrmModule.forFeature([...], AUTH_CONTEXT).
        autoLoadEntities: true,
        registerRequestContext: false,
      }),
    }),
  ],
})
export class AuthDatabaseModule {}
