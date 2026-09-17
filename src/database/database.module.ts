import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { BOOKING_MIGRATIONS } from './migrations';
import { BOOKING_CONTEXT, createOrmOptions } from './mikro-orm.options';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      contextName: BOOKING_CONTEXT,
      driver: PostgreSqlDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...createOrmOptions({
          clientUrl: config.getOrThrow<string>('database.url'),
          debug: config.get<string>('nodeEnv') === 'development',
          migrationsDir: 'migrations',
          migrations: BOOKING_MIGRATIONS,
        }),
        // Entities come from every MikroOrmModule.forFeature([...], BOOKING_CONTEXT).
        autoLoadEntities: true,
        // Per-request context for both databases is set up once in AppModule
        // (MikroOrmModule.forMiddleware()), not per context.
        registerRequestContext: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
