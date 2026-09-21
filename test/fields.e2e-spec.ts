import request from 'supertest';
import { login, mintCookie, type SessionCookie } from './support/auth';
import { API, TENANT_B } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { resetDomainTables } from './support/db';
import { expectError, expectValidationError } from './support/expect';
import { createField } from './support/fixtures';

describe('fields (e2e)', () => {
  let ctx: TestContext;
  let cookie: SessionCookie;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    cookie = await login(ctx.app);
  });

  afterAll(() => ctx.close());

  beforeEach(() => resetDomainTables(ctx.orm));

  describe('POST /fields', () => {
    it('creates the field and its pitches in one call', async () => {
      const res = await http()
        .post(`${API}/fields`)
        .set('Cookie', cookie)
        .send({ name: 'North Field', pitches: ['A', 'B'] });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'North Field',
        pitches: [
          { id: expect.any(String), name: 'A' },
          { id: expect.any(String), name: 'B' },
        ],
      });
      // PitchResponseDto carries neither the back-reference nor the timestamps.
      expect(res.body.pitches[0]).not.toHaveProperty('fieldId');
      expect(res.body.pitches[0]).not.toHaveProperty('tenantId');
    });

    it('accepts a field with no pitches yet', async () => {
      const res = await http()
        .post(`${API}/fields`)
        .set('Cookie', cookie)
        .send({ name: 'Empty Field', pitches: [] });

      expect(res.status).toBe(201);
      expect(res.body.pitches).toEqual([]);
    });

    it('validates the body', async () => {
      expectValidationError(
        await http()
          .post(`${API}/fields`)
          .set('Cookie', cookie)
          .send({ pitches: ['A'] }),
        'name should not be empty',
      );
      expectValidationError(
        await http().post(`${API}/fields`).set('Cookie', cookie).send({ name: 'X', pitches: 'A' }),
        'pitches must be an array',
      );
      expectValidationError(
        await http()
          .post(`${API}/fields`)
          .set('Cookie', cookie)
          .send({ name: 'X', pitches: [''] }),
        'each value in pitches should not be empty',
      );
    });

    it('rejects unknown keys', async () => {
      const res = await http()
        .post(`${API}/fields`)
        .set('Cookie', cookie)
        .send({ name: 'X', pitches: [], surface: 'grass' });

      expectValidationError(res, 'property surface should not exist');
    });
  });

  describe('GET /fields', () => {
    it('orders by name and populates the pitches', async () => {
      await createField(ctx.orm, 'South Field', ['A']);
      await createField(ctx.orm, 'North Field', ['A', 'B']);

      const res = await http().get(`${API}/fields`).set('Cookie', cookie).expect(200);

      expect(res.body.map((f: { name: string }) => f.name)).toEqual(['North Field', 'South Field']);
      // FieldResponseDto silently returns [] for an unpopulated collection, so a missing
      // `populate` would look like a field with no pitches rather than an error.
      expect(res.body[0].pitches).toHaveLength(2);
      expect(res.body[1].pitches).toHaveLength(1);
    });
  });

  describe('PUT /fields/:id', () => {
    it('renames the field and keeps its pitches', async () => {
      const field = await createField(ctx.orm, 'Old Name', ['A', 'B']);

      const res = await http()
        .put(`${API}/fields/${field.id}`)
        .set('Cookie', cookie)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.pitches).toHaveLength(2);
    });

    it('refuses to replace the pitch collection', async () => {
      const field = await createField(ctx.orm, 'North Field', ['A']);

      const res = await http()
        .put(`${API}/fields/${field.id}`)
        .set('Cookie', cookie)
        .send({ pitches: ['C'] });

      // UpdateFieldDto omits `pitches`, so forbidNonWhitelisted turns it into a 400
      // rather than silently ignoring it.
      expectValidationError(res, 'property pitches should not exist');
    });

    it('404s on an unknown id and 400s on a non-uuid id', async () => {
      expectError(
        await http()
          .put(`${API}/fields/11111111-1111-4111-8111-111111111111`)
          .set('Cookie', cookie)
          .send({ name: 'X' }),
        404,
        /^Field .* not found$/,
      );
      expectError(
        await http().put(`${API}/fields/abc`).set('Cookie', cookie).send({ name: 'X' }),
        400,
        'Validation failed (uuid is expected)',
      );
    });
  });

  describe('tenancy', () => {
    it('hides another tenant fields', async () => {
      const field = await createField(ctx.orm, 'North Field', ['A']);
      const otherTenant = mintCookie(ctx.app, { tenantId: TENANT_B });

      const list = await http().get(`${API}/fields`).set('Cookie', otherTenant).expect(200);
      expect(list.body).toEqual([]);

      expectError(
        await http()
          .put(`${API}/fields/${field.id}`)
          .set('Cookie', otherTenant)
          .send({ name: 'Hijacked' }),
        404,
        /^Field .* not found$/,
      );
    });
  });
});
