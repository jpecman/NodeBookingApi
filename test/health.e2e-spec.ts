import request from 'supertest';
import { login } from './support/auth';
import { API } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { expectError } from './support/expect';

/**
 * Also the harness smoke test: a green run here means the container started, the
 * migrations ran, the env override beat direnv, @Public() works, and
 * TenantContextInterceptor tolerates a request with no user (getCurrentTenantId() would
 * otherwise throw into a 500).
 *
 * Each test boots its own app, because what is being asserted is how the check behaves
 * before and after the connection pool has been used — an app shared through beforeAll
 * would make that order-dependent.
 */
describe('health (e2e)', () => {
  const create = async (): Promise<TestContext> => createTestApp();

  it('reports the database as down until something has queried it', async () => {
    const ctx = await create();

    try {
      // MikroORM v7's init() only discovers metadata; the pool connects lazily on the
      // first query. Terminus asks connection.isConnected(), which short-circuits on an
      // internal `connected` flag, so a freshly booted app reports 503 even though the
      // database is reachable. Pre-existing, and not something the harness causes.
      const res = await request(ctx.app.getHttpServer()).get(`${API}/health`);

      // AllExceptionsFilter rewrites Terminus's ServiceUnavailableException into the
      // standard error envelope, so the per-indicator details don't reach the client.
      expectError(res, 503, 'Service Unavailable Exception');
    } finally {
      await ctx.close();
    }
  });

  it('reports the database as up once the pool has been used', async () => {
    const ctx = await create();

    try {
      // Any query establishes the pool; logging in reads the users table.
      await login(ctx.app);

      const res = await request(ctx.app.getHttpServer()).get(`${API}/health`).expect(200);

      expect(res.body).toEqual({
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      });
    } finally {
      await ctx.close();
    }
  });
});
