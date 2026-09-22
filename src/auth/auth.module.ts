import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

/** One rate-limit bucket per (client IP, submitted email) — see docs/design-notes.md. */
function loginRateLimitTracker(req: Record<string, unknown>): string {
  const ip = typeof req.ip === 'string' ? req.ip : 'unknown';
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  return `${ip}:${email}`;
}

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        // JWT_EXPIRES_IN is validated as a non-empty string by env.validation.ts, but
        // @nestjs/jwt's type only accepts `ms`'s narrower StringValue literal union.
        signOptions: { expiresIn: config.getOrThrow<string>('jwt.expiresIn') as `${number}${'s' | 'm' | 'h' | 'd'}` },
      }),
    }),
    // The login policy, and the only throttler: POST /auth/login applies ThrottlerGuard by
    // hand, nothing else is rate limited. Rationale in docs/design-notes.md.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            limit: config.getOrThrow<number>('rateLimit.login.limit'),
            ttl: config.getOrThrow<number>('rateLimit.login.ttlMs'),
          },
        ],
        getTracker: loginRateLimitTracker,
        errorMessage: 'Too many login attempts. Please try again later.',
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Every route requires a valid JWT by default (mirrors BookingApi's BaseApiController
    // [Authorize]); opt out per-route with @Public(). RolesGuard runs after and no-ops
    // unless a route carries @Roles().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
