import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { ContactsModule } from './contacts/contacts.module';
import { TenancyModule } from './common/tenancy/tenancy.module';
import { AuthDatabaseModule } from './database/auth-database.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { FieldsModule } from './fields/fields.module';
import { PitchesModule } from './pitches/pitches.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [configuration],
      validate: validateEnv,
      cache: true,
    }),
    DatabaseModule,
    AuthDatabaseModule,
    // Forks both contexts' EntityManagers per request (RequestContext, AsyncLocalStorage).
    // Must come after the two database modules: it picks up the context names they registered.
    MikroOrmModule.forMiddleware(),
    TenancyModule,
    UsersModule,
    AuthModule,
    ContactsModule,
    FieldsModule,
    HealthModule,
    PitchesModule,
    BookingsModule,
    ReportsModule,
  ],
})
export class AppModule {}
