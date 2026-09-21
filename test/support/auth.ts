import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { UserRole } from '../../src/users/user-role.enum';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API, TENANT_A } from './constants';

/** A `token=<jwt>` pair, ready for `.set('Cookie', cookie)`. */
export type SessionCookie = string;

/** Pulls the `token=…` pair out of a Set-Cookie header, dropping the attributes. */
export function extractTokenCookie(res: request.Response): SessionCookie {
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
  const token = setCookie?.find((cookie) => cookie.startsWith('token='));

  if (!token) {
    throw new Error('response did not set a token cookie');
  }

  return token.split(';')[0];
}

export async function login(
  app: INestApplication,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
): Promise<SessionCookie> {
  // 201, not 200: @Post('login') carries no @HttpCode, unlike logout/change-password.
  const res = await request(app.getHttpServer())
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(201);

  return extractTokenCookie(res);
}

interface TokenClaims {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

/**
 * A session cookie for arbitrary claims, signed with the app's own secret.
 *
 * JwtStrategy.validate() never loads the user — it only reads sub/email/tenantId off the
 * payload — so this needs no users row, which is exactly what the cross-tenant tests want.
 */
export function mintCookie(
  app: INestApplication,
  overrides: Partial<TokenClaims> = {},
): SessionCookie {
  const jwt = app.get(JwtService, { strict: false });

  const claims: TokenClaims = {
    sub: '00000000-0000-4000-8000-00000000f00d',
    email: 'minted@example.com',
    role: UserRole.Administrator,
    tenantId: TENANT_A,
    ...overrides,
  };

  return `token=${jwt.sign(claims)}`;
}
