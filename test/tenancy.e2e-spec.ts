import request from 'supertest';
import { Booking } from '../src/bookings/entities/bookings.entity';
import { Contact } from '../src/contacts/entities/contact.entity';
import { Field } from '../src/fields/entities/field.entity';
import { Pitch } from '../src/pitches/entities/pitch.entity';
import { Slot } from '../src/slots/entities/slot.entity';
import { login, mintCookie, type SessionCookie } from './support/auth';
import { API, TENANT_A, TENANT_B } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { resetDomainTables } from './support/db';
import { asTenant, createContact, createField } from './support/fixtures';

/**
 * The isolation mechanism itself, rather than per-resource visibility (which each
 * resource's own spec covers). What matters here is that the tenant comes from the JWT on
 * both the read and the write side, and that it propagates through the persist cascade.
 */
describe('tenancy (e2e)', () => {
  let ctx: TestContext;
  let cookieA: SessionCookie;
  let cookieB: SessionCookie;

  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    cookieA = await login(ctx.app);
    cookieB = mintCookie(ctx.app, { tenantId: TENANT_B, email: 'tenant-b@example.com' });
  });

  afterAll(() => ctx.close());

  beforeEach(() => resetDomainTables(ctx.orm));

  it('stamps new rows with the JWT tenant, not the default one', async () => {
    const res = await http()
      .post(`${API}/contacts`)
      .set('Cookie', cookieB)
      .send({ firstName: 'Tenant', lastName: 'B' })
      .expect(201);

    // currentTenantOnCreate reads the request's AsyncLocalStorage, so DEFAULT_TENANT_ID
    // must play no part here.
    await asTenant(ctx.orm, TENANT_B, async (em) => {
      const contact = await em.findOneOrFail(Contact, { id: res.body.id });
      expect(contact.tenantId).toBe(TENANT_B);
    });
    await asTenant(ctx.orm, TENANT_A, async (em) => {
      expect(await em.count(Contact)).toBe(0);
    });
  });

  it('propagates the stamp through the persist cascade to pitches', async () => {
    const res = await http()
      .post(`${API}/fields`)
      .set('Cookie', cookieB)
      .send({ name: 'Tenant B Field', pitches: ['A', 'B'] })
      .expect(201);

    await asTenant(ctx.orm, TENANT_B, async (em) => {
      const field = await em.findOneOrFail(Field, { id: res.body.id }, { populate: ['pitches'] });
      expect(field.tenantId).toBe(TENANT_B);
      // The onCreate hook fires for every entity in the cascade, not just the root.
      expect(field.pitches.getItems().map((pitch) => pitch.tenantId)).toEqual([TENANT_B, TENANT_B]);
    });
  });

  it('propagates the stamp to bookings and their slots', async () => {
    const contact = await createContact(ctx.orm, { email: 'b@example.com' }, TENANT_B);
    const field = await createField(ctx.orm, 'Tenant B Field', ['A'], TENANT_B);

    const res = await http()
      .post(`${API}/bookings`)
      .set('Cookie', cookieB)
      .send({
        name: 'Weekly training',
        from: '2026-09-21T16:00:00Z',
        duration: 90,
        price: 1200,
        isWholeField: false,
        contactId: contact.id,
        fieldId: field.id,
      })
      .expect(201);

    await asTenant(ctx.orm, TENANT_B, async (em) => {
      const booking = await em.findOneOrFail(Booking, { id: res.body.id }, { populate: ['slots'] });
      expect(booking.tenantId).toBe(TENANT_B);
      expect(booking.slots.getItems().map((slot) => slot.tenantId)).toEqual([TENANT_B]);
    });
  });

  it('keeps identical data in two tenants completely separate', async () => {
    for (const [tenantId, cookie] of [
      [TENANT_A, cookieA],
      [TENANT_B, cookieB],
    ] as const) {
      const contact = await createContact(ctx.orm, { email: 'same@example.com' }, tenantId);
      const field = await createField(ctx.orm, 'Same Name Field', ['A'], tenantId);

      await http()
        .post(`${API}/bookings`)
        .set('Cookie', cookie)
        .send({
          name: 'Weekly training',
          from: '2026-09-21T16:00:00Z',
          duration: 90,
          price: 1200,
          isWholeField: false,
          contactId: contact.id,
          fieldId: field.id,
        })
        .expect(201);
    }

    // Both tenants now hold a same-named field and a same-emailed contact, and both booked
    // the same hour — the unique index and the exclusion constraint both tolerate that
    // because they are scoped per tenant / per pitch.
    await asTenant(ctx.orm, TENANT_A, async (em) => {
      expect(await em.count(Contact)).toBe(1);
      expect(await em.count(Pitch)).toBe(1);
      expect(await em.count(Slot)).toBe(1);
    });

    const window = { from: '2026-09-21T00:00:00Z', to: '2026-09-22T00:00:00Z' };

    for (const cookie of [cookieA, cookieB]) {
      expect((await http().get(`${API}/contacts`).set('Cookie', cookie)).body).toHaveLength(1);
      expect((await http().get(`${API}/fields`).set('Cookie', cookie)).body).toHaveLength(1);
      expect(
        (await http().get(`${API}/bookings`).query(window).set('Cookie', cookie)).body,
      ).toHaveLength(1);
      expect(
        (await http().get(`${API}/reports/contact-bookings`).query(window).set('Cookie', cookie))
          .body,
      ).toHaveLength(1);
    }
  });

  it('leaves public routes outside the tenant context entirely', async () => {
    // TenantContextInterceptor opens no context when there is no request.user. If it did,
    // getCurrentTenantId() would throw and this would be a 500.
    await http().get(`${API}/health`).expect(200);
  });

  it('does not scope the allocator across tenants — findOccupied bypasses the filter', async () => {
    const field = await createField(ctx.orm, 'Shared Pitch Field', ['Only'], TENANT_A);
    const [pitch] = field.pitches.getItems();

    await asTenant(ctx.orm, TENANT_A, async (em) => {
      expect(await em.count(Pitch, { id: pitch.id })).toBe(1);
    });
    // TENANT_B cannot see the field at all, so it can never reach the allocator with this
    // pitch. The leak that does exist runs the other way and is pinned in
    // bookings.e2e-spec.ts: a slot owned by another tenant is invisible to findOccupied()
    // (QueryBuilder skips TENANT_FILTER, so it scopes by hand) while the database's
    // exclusion constraint still sees it — which surfaces as a 500.
    await asTenant(ctx.orm, TENANT_B, async (em) => {
      expect(await em.count(Field)).toBe(0);
    });
  });
});
