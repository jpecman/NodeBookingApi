import request from 'supertest';
import { Booking } from '../src/bookings/entities/bookings.entity';
import { Field } from '../src/fields/entities/field.entity';
import { Pitch } from '../src/pitches/entities/pitch.entity';
import { Slot } from '../src/slots/entities/slot.entity';
import { login, mintCookie, type SessionCookie } from './support/auth';
import { API, TENANT_A, TENANT_B } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { resetDomainTables } from './support/db';
import { expectError, expectValidationError } from './support/expect';
import { asTenant, createContact, createField } from './support/fixtures';

const VALID = {
  firstName: 'Jan',
  lastName: 'Novák',
  email: 'jan.novak@example.com',
  phone: '777123456',
  show: true,
};

describe('contacts (e2e)', () => {
  let ctx: TestContext;
  let cookie: SessionCookie;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
    cookie = await login(ctx.app);
  });

  afterAll(() => ctx.close());

  beforeEach(() => resetDomainTables(ctx.orm));

  describe('POST /contacts', () => {
    it('creates a contact and returns only the wire shape', async () => {
      const res = await http().post(`${API}/contacts`).set('Cookie', cookie).send(VALID);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: expect.any(String), ...VALID });
      // tenantId and the timestamps are persistence concerns and must not leak.
      expect(res.body).not.toHaveProperty('tenantId');
      expect(res.body).not.toHaveProperty('createdAt');
      expect(res.body).not.toHaveProperty('updatedAt');
    });

    it('defaults show to false', async () => {
      const res = await http()
        .post(`${API}/contacts`)
        .set('Cookie', cookie)
        .send({ firstName: 'Petr', lastName: 'Svoboda' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ show: false, email: null, phone: null });
    });

    it('validates field contents', async () => {
      const res = await http()
        .post(`${API}/contacts`)
        .set('Cookie', cookie)
        .send({ firstName: '', lastName: 'x'.repeat(31), email: 'not-an-email' });

      expectValidationError(
        res,
        'firstName should not be empty',
        'lastName must be shorter than or equal to 30 characters',
        'email must be an email',
      );
    });

    it('rejects unknown keys', async () => {
      const res = await http()
        .post(`${API}/contacts`)
        .set('Cookie', cookie)
        .send({ ...VALID, nickname: 'Honza' });

      expectValidationError(res, 'property nickname should not exist');
    });

    it('maps a duplicate email to a friendly 409', async () => {
      await http().post(`${API}/contacts`).set('Cookie', cookie).send(VALID).expect(201);

      const res = await http()
        .post(`${API}/contacts`)
        .set('Cookie', cookie)
        .send({ ...VALID, firstName: 'Someone', lastName: 'Else' });

      // The text comes from CONSTRAINT_MESSAGES['ux_contacts_tenant_id_email'].
      expectError(res, 409, 'A contact with this email address already exists.');
    });

    it('allows any number of contacts without an email', async () => {
      const body = { firstName: 'Bez', lastName: 'Mailu' };

      await http().post(`${API}/contacts`).set('Cookie', cookie).send(body).expect(201);
      // Postgres treats NULLs as distinct, so the unique index does not apply.
      await http().post(`${API}/contacts`).set('Cookie', cookie).send(body).expect(201);
    });
  });

  describe('GET /contacts', () => {
    it('orders by last name, then first name', async () => {
      await createContact(ctx.orm, { firstName: 'Břetislav', lastName: 'Novák' });
      await createContact(ctx.orm, { firstName: 'Adam', lastName: 'Novák' });
      await createContact(ctx.orm, { firstName: 'Zdeněk', lastName: 'Adamec' });

      const res = await http().get(`${API}/contacts`).set('Cookie', cookie).expect(200);

      expect(
        res.body.map(
          (c: { firstName: string; lastName: string }) => `${c.lastName} ${c.firstName}`,
        ),
      ).toEqual(['Adamec Zdeněk', 'Novák Adam', 'Novák Břetislav']);
    });
  });

  describe('GET /contacts/:id', () => {
    it('returns the contact', async () => {
      const contact = await createContact(ctx.orm, { firstName: 'Jan', lastName: 'Novák' });

      const res = await http().get(`${API}/contacts/${contact.id}`).set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: contact.id, firstName: 'Jan' });
    });

    it('404s on an unknown id', async () => {
      const res = await http()
        .get(`${API}/contacts/11111111-1111-4111-8111-111111111111`)
        .set('Cookie', cookie);

      expectError(res, 404, /^Contact .* not found$/);
    });

  });

  describe('PUT /contacts/:id', () => {
    it('updates only the keys present', async () => {
      const contact = await createContact(ctx.orm, {
        firstName: 'Jan',
        lastName: 'Novák',
        phone: '111',
      });

      const res = await http()
        .put(`${API}/contacts/${contact.id}`)
        .set('Cookie', cookie)
        .send({ phone: '999' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ firstName: 'Jan', lastName: 'Novák', phone: '999' });
    });

    it('accepts an explicit null and an empty body', async () => {
      const contact = await createContact(ctx.orm, { email: 'clear.me@example.com' });

      const cleared = await http()
        .put(`${API}/contacts/${contact.id}`)
        .set('Cookie', cookie)
        .send({ email: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.email).toBeNull();

      await http().put(`${API}/contacts/${contact.id}`).set('Cookie', cookie).send({}).expect(200);
    });

    it('rejects unknown keys, unknown ids and non-uuid ids', async () => {
      const contact = await createContact(ctx.orm);

      expectValidationError(
        await http()
          .put(`${API}/contacts/${contact.id}`)
          .set('Cookie', cookie)
          .send({ nickname: 'x' }),
        'property nickname should not exist',
      );
      expectError(
        await http()
          .put(`${API}/contacts/11111111-1111-4111-8111-111111111111`)
          .set('Cookie', cookie)
          .send({ phone: '1' }),
        404,
        /^Contact .* not found$/,
      );
      expectError(
        await http().put(`${API}/contacts/abc`).set('Cookie', cookie).send({ phone: '1' }),
        400,
        'Validation failed (uuid is expected)',
      );
    });

    it('409s when taking an email another contact already owns', async () => {
      await createContact(ctx.orm, { email: 'taken@example.com' });
      const other = await createContact(ctx.orm, { email: 'free@example.com' });

      const res = await http()
        .put(`${API}/contacts/${other.id}`)
        .set('Cookie', cookie)
        .send({ email: 'taken@example.com' });

      expectError(res, 409, 'A contact with this email address already exists.');
    });
  });

  describe('DELETE /contacts/:id', () => {
    it('returns 204 and removes the contact', async () => {
      const contact = await createContact(ctx.orm);

      const res = await http().delete(`${API}/contacts/${contact.id}`).set('Cookie', cookie);
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});

      await http().get(`${API}/contacts/${contact.id}`).set('Cookie', cookie).expect(404);
    });

    it('404s on an unknown id', async () => {
      const res = await http()
        .delete(`${API}/contacts/11111111-1111-4111-8111-111111111111`)
        .set('Cookie', cookie);

      expectError(res, 404, /^Contact .* not found$/);
    });

    it('cascades to the contact bookings and slots, leaving the field intact', async () => {
      const contact = await createContact(ctx.orm, { email: 'cascade@example.com' });
      const field = await createField(ctx.orm, 'Cascade Field', ['A', 'B']);

      await http()
        .post(`${API}/bookings`)
        .set('Cookie', cookie)
        .send({
          name: 'Weekly training',
          from: '2026-09-21T18:00:00Z',
          endDate: '2026-10-05T18:00:00Z',
          duration: 90,
          price: 1200,
          isWholeField: false,
          contactId: contact.id,
          fieldId: field.id,
        })
        .expect(201);

      await http().delete(`${API}/contacts/${contact.id}`).set('Cookie', cookie).expect(204);

      await asTenant(ctx.orm, TENANT_A, async (em) => {
        // bookings.contact_id and slots.booking_id both cascade in the database.
        expect(await em.count(Booking)).toBe(0);
        expect(await em.count(Slot)).toBe(0);
        // The field is a separate aggregate and must survive.
        expect(await em.count(Field)).toBe(1);
        expect(await em.count(Pitch)).toBe(2);
      });
    });
  });

  describe('tenancy', () => {
    it('hides another tenant rows from every route', async () => {
      const contact = await createContact(ctx.orm, { email: 'a@example.com' }, TENANT_A);
      const otherTenant = mintCookie(ctx.app, { tenantId: TENANT_B });

      const list = await http().get(`${API}/contacts`).set('Cookie', otherTenant).expect(200);
      expect(list.body).toEqual([]);

      expectError(
        await http().get(`${API}/contacts/${contact.id}`).set('Cookie', otherTenant),
        404,
        /^Contact .* not found$/,
      );
      expectError(
        await http()
          .put(`${API}/contacts/${contact.id}`)
          .set('Cookie', otherTenant)
          .send({ phone: '1' }),
        404,
        /^Contact .* not found$/,
      );
      expectError(
        await http().delete(`${API}/contacts/${contact.id}`).set('Cookie', otherTenant),
        404,
        /^Contact .* not found$/,
      );
    });

    it('keeps each tenant writes to itself', async () => {
      await createContact(ctx.orm, { email: 'a@example.com' }, TENANT_A);

      await http()
        .post(`${API}/contacts`)
        .set('Cookie', mintCookie(ctx.app, { tenantId: TENANT_B }))
        .send({ firstName: 'Tenant', lastName: 'B', email: 'b@example.com' })
        .expect(201);

      const mine = await http().get(`${API}/contacts`).set('Cookie', cookie).expect(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0].email).toBe('a@example.com');
    });
  });
});
