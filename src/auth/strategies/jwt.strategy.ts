import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { UserRole } from '../../users/user-role.enum';
import { AuthenticatedUser } from '../types/authenticated-user';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

function cookieExtractor(req: Request): string | null {
  return (req?.cookies?.token as string | undefined) ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.email || !payload.tenantId) {
      throw new UnauthorizedException();
    }

    // The tenant context is opened by TenantContextInterceptor from this return value,
    // not here — see tenant-context.interceptor.ts for why enterWith() can't work.
    return { id: payload.sub, email: payload.email, role: payload.role, tenantId: payload.tenantId };
  }
}
