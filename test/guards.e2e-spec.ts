import request from 'supertest';
import { login, type SessionCookie } from './support/auth';
import { API } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { expectError } from './support/expect';

const UUID = '11111111-1111-4111-8111-111111111111';

/** Every route that JwtAuthGuard protects — i.e. everything without @Public(). */
const GUARDED: [method: 'get' | 'post' | 'put' | 'delete', path: string][] = [
  ['post', `${API}/auth/logout`],
  ['get', `${API}/auth/me`],
  ['post', `${API}/auth/change-password`],
  ['post', `${API}/contacts`],
  ['get', `${API}/contacts`],
  ['get', `${API}/contacts/${UUID}`],
  ['put', `${API}/contacts/${UUID}`],
  ['delete', `${API}/contacts/${UUID}`],
  ['post', `${API}/fields`],
  ['get', `${API}/fields`],
  ['put', `${API}/fields/${UUID}`],
  ['get', `${API}/bookings`],
  ['post', `${API}/bookings`],
  ['get', `${API}/reports/contact-bookings`],
];

describe('guards (e2e)', () => {
  let ctx: TestContext;
  let cookie: SessionCookie;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    cookie = await login(ctx.app);
  });

  afterAll(() => ctx.close());

  // No resetDomainTables: none of these requests get far enough to touch a row.

  it.each(GUARDED)('%s %s requires a session', async (method, path) => {
    // The guard runs before the ValidationPipe, so an empty body still yields 401 and not
    // a 400 — which is the property being pinned.
    expectError(await http()[method](path), 401, 'Unauthorized');
  });

  it.each([
    ['post', `${API}/auth/login`],
    ['get', `${API}/health`],
  ] as const)('%s %s is public', async (method, path) => {
    const res = await http()[method](path);

    expect(res.status).not.toBe(401);
  });

  it('404s an unmatched route before the guards see it', async () => {
    const res = await http().get(`${API}/does-not-exist`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(`Cannot GET ${API}/does-not-exist`);
  });

  it('has no delete route for fields', async () => {
    // With a valid session, so a 404 means "no such handler" rather than "not authorised".
    const res = await http().delete(`${API}/fields/${UUID}`).set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('serves nothing outside the api/v1 prefix', async () => {
    expect((await http().get('/contacts').set('Cookie', cookie)).status).toBe(404);
  });
});
