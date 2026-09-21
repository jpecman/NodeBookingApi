import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { UserRole } from '../src/users/user-role.enum';
import { extractTokenCookie, login } from './support/auth';
import { ADMIN_EMAIL, API, TENANT_A } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { deleteUsersExcept } from './support/db';
import { expectError, expectValidationError } from './support/expect';
import { createUser } from './support/fixtures';

const EMAIL = 'auth-spec@nodebooking.local';
const PASSWORD = 'AuthSpecPassword1!';

describe('auth (e2e)', () => {
  let ctx: TestContext;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.close());

  // This spec owns its user because change-password mutates it. The shared admin that
  // globalSetup provisioned is left alone.
  beforeEach(async () => {
    await deleteUsersExcept(ctx.orm, ADMIN_EMAIL);
    await createUser(ctx.orm, { email: EMAIL, password: PASSWORD });
  });

  describe('POST /auth/login', () => {
    it('returns the current user and sets the session cookie', async () => {
      // 201 rather than the documented 200: @Post('login') carries no @HttpCode, unlike
      // logout and change-password.
      const res = await http().post(`${API}/auth/login`).send({ email: EMAIL, password: PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: EMAIL,
        role: UserRole.Administrator,
      });
      // The tenant is a JWT claim, never part of the response body.
      expect(res.body).not.toHaveProperty('tenantId');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('sets an httpOnly, lax, non-secure cookie outside production', async () => {
      const res = await http().post(`${API}/auth/login`).send({ email: EMAIL, password: PASSWORD });
      const [cookie] = res.headers['set-cookie'] as unknown as string[];

      expect(cookie).toContain('token=');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      // JWT_EXPIRES_IN is 8h in the test env; parseDurationMs turns it into seconds here.
      expect(cookie).toContain('Max-Age=28800');
      expect(cookie).not.toContain('Secure');
    });

    it('rejects a wrong password and an unknown email identically', async () => {
      const wrongPassword = await http()
        .post(`${API}/auth/login`)
        .send({ email: EMAIL, password: 'not-the-password' });
      const unknownEmail = await http()
        .post(`${API}/auth/login`)
        .send({ email: 'nobody@nodebooking.local', password: PASSWORD });

      // Same status and same message, so neither reveals whether the account exists.
      expectError(wrongPassword, 401, 'Invalid email or password');
      expectError(unknownEmail, 401, 'Invalid email or password');
    });

    it('validates the body', async () => {
      const res = await http().post(`${API}/auth/login`).send({ email: 'not-an-email' });

      expectValidationError(res, 'email must be an email', 'password should not be empty');
    });

    it('rejects unknown keys', async () => {
      const res = await http()
        .post(`${API}/auth/login`)
        .send({ email: EMAIL, password: PASSWORD, rememberMe: true });

      expectValidationError(res, 'property rememberMe should not exist');
    });
  });

  describe('GET /auth/me', () => {
    it('returns the authenticated user', async () => {
      const cookie = await login(ctx.app, EMAIL, PASSWORD);
      const res = await http().get(`${API}/auth/me`).set('Cookie', cookie).expect(200);

      expect(res.body).toEqual({
        id: expect.any(String),
        email: EMAIL,
        role: UserRole.Administrator,
      });
    });

    it('rejects a missing, malformed or foreign-signed token', async () => {
      const foreign = new JwtService({ secret: 'a-completely-different-secret' }).sign({
        sub: '00000000-0000-4000-8000-00000000f00d',
        email: EMAIL,
        role: UserRole.Administrator,
        tenantId: TENANT_A,
      });

      expectError(await http().get(`${API}/auth/me`), 401, 'Unauthorized');
      expectError(
        await http().get(`${API}/auth/me`).set('Cookie', 'token=garbage'),
        401,
        'Unauthorized',
      );
      expectError(
        await http().get(`${API}/auth/me`).set('Cookie', `token=${foreign}`),
        401,
        'Unauthorized',
      );
    });

    it('rejects an expired token', async () => {
      const jwt = ctx.app.get(JwtService, { strict: false });
      const expired = jwt.sign(
        {
          sub: '00000000-0000-4000-8000-00000000f00d',
          email: EMAIL,
          role: UserRole.Administrator,
          tenantId: TENANT_A,
        },
        { expiresIn: '-1s' },
      );

      expectError(
        await http().get(`${API}/auth/me`).set('Cookie', `token=${expired}`),
        401,
        'Unauthorized',
      );
    });

    it('ignores a bearer token — JwtStrategy reads the cookie only', async () => {
      const cookie = await login(ctx.app, EMAIL, PASSWORD);
      const token = cookie.replace('token=', '');

      const res = await http().get(`${API}/auth/me`).set('Authorization', `Bearer ${token}`);

      expectError(res, 401, 'Unauthorized');
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie', async () => {
      const cookie = await login(ctx.app, EMAIL, PASSWORD);
      const res = await http().post(`${API}/auth/logout`).set('Cookie', cookie).expect(200);

      const [cleared] = res.headers['set-cookie'] as unknown as string[];
      expect(cleared).toContain('token=;');
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('requires a session — logout is not @Public()', async () => {
      expectError(await http().post(`${API}/auth/logout`), 401, 'Unauthorized');
    });
  });

  describe('POST /auth/change-password', () => {
    const NEW_PASSWORD = 'BrandNewPassword1!';

    it('replaces the password', async () => {
      const cookie = await login(ctx.app, EMAIL, PASSWORD);

      await http()
        .post(`${API}/auth/change-password`)
        .set('Cookie', cookie)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);

      await http()
        .post(`${API}/auth/login`)
        .send({ email: EMAIL, password: NEW_PASSWORD })
        .expect(201);
      await http().post(`${API}/auth/login`).send({ email: EMAIL, password: PASSWORD }).expect(401);
    });

    it('rejects a wrong current password', async () => {
      const cookie = await login(ctx.app, EMAIL, PASSWORD);

      const res = await http()
        .post(`${API}/auth/change-password`)
        .set('Cookie', cookie)
        .send({ currentPassword: 'wrong', newPassword: NEW_PASSWORD });

      expectError(res, 401, 'Current password is incorrect');
    });

    it('enforces the minimum new-password length', async () => {
      const cookie = await login(ctx.app, EMAIL, PASSWORD);

      const res = await http()
        .post(`${API}/auth/change-password`)
        .set('Cookie', cookie)
        .send({ currentPassword: PASSWORD, newPassword: 'short1234' });

      expectValidationError(res, 'newPassword must be longer than or equal to 10 characters');
    });

    it('requires a session', async () => {
      const res = await http()
        .post(`${API}/auth/change-password`)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

      expectError(res, 401, 'Unauthorized');
    });
  });

  it('issues a cookie that carries the tenant claim', async () => {
    const res = await http().post(`${API}/auth/login`).send({ email: EMAIL, password: PASSWORD });
    const token = extractTokenCookie(res).replace('token=', '');
    const claims = ctx.app.get(JwtService, { strict: false }).decode(token);

    expect(claims).toMatchObject({
      email: EMAIL,
      role: UserRole.Administrator,
      tenantId: TENANT_A,
    });
  });
});
