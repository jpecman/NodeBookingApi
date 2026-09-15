import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

export const AUTH_CONNECTION = 'auth';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: AUTH_CONNECTION,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('authDatabase.url'),
        // Entities are picked up from every TypeOrmModule.forFeature([...], AUTH_CONNECTION) registration.
        autoLoadEntities: true,
        migrations: [join(__dirname, 'migrations', 'auth', '*.{ts,js}')],
        // Schema changes go through migrations only — never let TypeORM alter the DB.
        synchronize: false,
        migrationsRun: false,
        logging: config.get<string>('nodeEnv') === 'development' ? ['query', 'error'] : ['error'],
      }),
    }),
  ],
})
export class AuthDatabaseModule {}
