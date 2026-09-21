import request from 'supertest';
import type { Field } from '../src/fields/entities/field.entity';
import { SlotStatus } from '../src/slots/slot-status.enum';
import { login, mintCookie, type SessionCookie } from './support/auth';
import { API, TENANT_B } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { resetDomainTables } from './support/db';
import { expectValidationError } from './support/expect';
import { createContact, createField, createRawSlot } from './support/fixtures';

const WINDOW = { from: '2026-09-21T00:00:00Z', to: '2026-09-22T00:00:00Z' };

describe('reports (e2e)', () => {
  let ctx: TestContext;
  let cookie: SessionCookie;
  let field: Field;
  let pitchA: string;
  let pitchB: string;

  const http = () => request(ctx.app.getHttpServer());
  const report = (query: Record<string, string> = WINDOW) =>
    http().get(`${API}/reports/contact-bookings`).query(query).set('Cookie', cookie);

  beforeAll(async () => {
    ctx = await createTestApp();
    cookie = await login(ctx.app);
  });

  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDomainTables(ctx.orm);
    field = await createField(ctx.orm, 'North Field', ['A', 'B']);
    [pitchA, pitchB] = field.pitches.getItems().map((pitch) => pitch.id);
  });

  it('aggregates a contact slots into one row', async () => {
    const contact = await createContact(ctx.orm, { email: 'one@example.com' });

    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchA,
      from: new Date('2026-09-21T16:00:00Z'),
      to: new Date('2026-09-21T17:30:00Z'),
      price: 1200,
    });
    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchB,
      from: new Date('2026-09-21T18:00:00Z'),
      to: new Date('2026-09-21T19:30:00Z'),
      price: 800,
    });

    const res = await report().expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual({
      contact: expect.objectContaining({ id: contact.id, email: 'one@example.com' }),
      // createRawSlot makes one booking per slot, so two slots means two bookings.
      bookingCount: 2,
      totalPrice: 2000,
      earliestBookingDate: '2026-09-21T16:00:00.000Z',
      latestBookingDate: '2026-09-21T19:30:00.000Z',
      status: SlotStatus.Booked,
    });
  });

  it('requires the whole slot to lie inside the window, unlike the booking search', async () => {
    const contact = await createContact(ctx.orm, { email: 'edge@example.com' });

    // Ends exactly at the window's upper bound — counted (upper <= to).
    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchA,
      from: new Date('2026-09-21T22:00:00Z'),
      to: new Date('2026-09-22T00:00:00Z'),
      price: 500,
    });

    expect((await report()).body[0].totalPrice).toBe(500);

    // One millisecond past it — excluded from the report, but /bookings still matches it,
    // because that query only looks at the slot's start.
    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchB,
      from: new Date('2026-09-21T23:00:00Z'),
      to: new Date('2026-09-22T00:00:00.001Z'),
      price: 700,
    });

    expect((await report()).body[0].totalPrice).toBe(500);

    const bookings = await http().get(`${API}/bookings`).query(WINDOW).set('Cookie', cookie);
    expect(bookings.body).toHaveLength(2);
  });

  it('excludes cancelled slots from the sum and the count', async () => {
    const contact = await createContact(ctx.orm, { email: 'cancelled@example.com' });

    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchA,
      from: new Date('2026-09-21T16:00:00Z'),
      to: new Date('2026-09-21T17:30:00Z'),
      price: 1200,
    });
    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchB,
      from: new Date('2026-09-21T16:00:00Z'),
      to: new Date('2026-09-21T17:30:00Z'),
      price: 999,
      status: SlotStatus.Cancelled,
    });

    const res = await report().expect(200);

    expect(res.body[0].totalPrice).toBe(1200);
    expect(res.body[0].bookingCount).toBe(1);
  });

  it('reports the least-progressed status', async () => {
    const contact = await createContact(ctx.orm, { email: 'status@example.com' });

    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchA,
      from: new Date('2026-09-21T16:00:00Z'),
      to: new Date('2026-09-21T17:30:00Z'),
      status: SlotStatus.Paid,
    });
    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchB,
      from: new Date('2026-09-21T18:00:00Z'),
      to: new Date('2026-09-21T19:30:00Z'),
      status: SlotStatus.Booked,
    });

    // Min of the enum: a single unpaid slot keeps the whole row at Booked.
    expect((await report()).body[0].status).toBe(SlotStatus.Booked);
  });

  it('returns one row per contact', async () => {
    const first = await createContact(ctx.orm, { email: 'first@example.com' });
    const second = await createContact(ctx.orm, { email: 'second@example.com' });

    await createRawSlot(ctx.orm, {
      contactId: first.id,
      pitchId: pitchA,
      from: new Date('2026-09-21T16:00:00Z'),
      to: new Date('2026-09-21T17:30:00Z'),
    });
    await createRawSlot(ctx.orm, {
      contactId: second.id,
      pitchId: pitchB,
      from: new Date('2026-09-21T16:00:00Z'),
      to: new Date('2026-09-21T17:30:00Z'),
    });

    expect((await report()).body).toHaveLength(2);
  });

  it('returns an empty array for a window with nothing in it', async () => {
    const res = await report({ from: '2030-01-01T00:00:00Z', to: '2030-01-02T00:00:00Z' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('validates the query', async () => {
    expectValidationError(
      await http().get(`${API}/reports/contact-bookings`).set('Cookie', cookie),
      'from must be a Date instance',
      'to must be a Date instance',
    );
    // SearchReportsDto has only from/to — includeCancelled is a booking-search concept and
    // forbidNonWhitelisted rejects it here.
    expectValidationError(
      await report({ ...WINDOW, includeCancelled: 'true' }),
      'property includeCancelled should not exist',
    );
  });

  it('hides another tenant rows', async () => {
    const contact = await createContact(ctx.orm, { email: 'mine@example.com' });
    await createRawSlot(ctx.orm, {
      contactId: contact.id,
      pitchId: pitchA,
      from: new Date('2026-09-21T16:00:00Z'),
      to: new Date('2026-09-21T17:30:00Z'),
    });

    const res = await http()
      .get(`${API}/reports/contact-bookings`)
      .query(WINDOW)
      .set('Cookie', mintCookie(ctx.app, { tenantId: TENANT_B }))
      .expect(200);

    expect(res.body).toEqual([]);
  });
});
