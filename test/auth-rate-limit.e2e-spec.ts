import request from 'supertest';
import { ADMIN_EMAIL, API } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { deleteUsersExcept } from './support/db';
import { expectError } from './support/expect';
import { createUser } from './support/fixtures';
import { resetRateLimit } from './support/throttle';

const EMAIL = 'rate-limit-spec@nodebooking.local';
const PASSWORD = 'RateLimitPassword1!';
const WRONG = 'not-the-password';

/** setup-env.ts pins LOGIN_RATE_LIMIT/LOGIN_RATE_TTL, so these numbers are the real policy. */
const LIMIT = 5;
const BLOCKED_MESSAGE = 'Too many login attempts. Please try again later.';

describe('login rate limiting (e2e)', () => {
  let ctx: TestContext;
  const attempt = (email: string, password: string) =>
    request(ctx.app.getHttpServer()).post(`${API}/auth/login`).send({ email, password });

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.close());

  beforeEach(async () => {
    resetRateLimit(ctx.app);
    await deleteUsersExcept(ctx.orm, ADMIN_EMAIL);
    await createUser(ctx.orm, { email: EMAIL, password: PASSWORD });
  });

  it('allows the first five attempts and blocks the sixth', async () => {
    for (let i = 0; i < LIMIT; i++) {
      expectError(await attempt(EMAIL, WRONG), 401, 'Invalid email or password');
    }

    const blocked = await attempt(EMAIL, WRONG);

    expectError(blocked, 429, BLOCKED_MESSAGE);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('blocks the correct password too, once the budget is spent', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await attempt(EMAIL, WRONG);
    }

    // The block is on the attempt, not on the failure.
    expectError(await attempt(EMAIL, PASSWORD), 429, BLOCKED_MESSAGE);
  });

  it('counts attempts per email, so one address cannot block another', async () => {
    for (let i = 0; i <= LIMIT; i++) {
      await attempt(EMAIL, WRONG);
    }

    // Same connection, same IP — only the email differs, and it has its own budget.
    expectError(await attempt(ADMIN_EMAIL, WRONG), 401, 'Invalid email or password');
  });

  it('spends the budget on unknown emails as well, capping enumeration', async () => {
    const unknown = 'nobody@nodebooking.local';

    for (let i = 0; i < LIMIT; i++) {
      expectError(await attempt(unknown, WRONG), 401, 'Invalid email or password');
    }

    expectError(await attempt(unknown, WRONG), 429, BLOCKED_MESSAGE);
  });

  it('reports the remaining budget on a successful login', async () => {
    const res = await attempt(EMAIL, PASSWORD).expect(201);

    expect(res.headers['x-ratelimit-limit']).toBe(String(LIMIT));
    expect(res.headers['x-ratelimit-remaining']).toBe(String(LIMIT - 1));
  });

  it('leaves every other route alone while login is blocked', async () => {
    const session = await attempt(EMAIL, PASSWORD).expect(201);
    const cookie = (session.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

    for (let i = 0; i < LIMIT; i++) {
      await attempt(EMAIL, WRONG);
    }
    expectError(await attempt(EMAIL, PASSWORD), 429, BLOCKED_MESSAGE);

    // Only POST /auth/login carries ThrottlerGuard; an established session is unaffected.
    await request(ctx.app.getHttpServer()).get(`${API}/auth/me`).set('Cookie', cookie).expect(200);
  });
});
