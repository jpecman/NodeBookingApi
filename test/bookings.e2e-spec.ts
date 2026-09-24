import request from 'supertest';
import type { Contact } from '../src/contacts/entities/contact.entity';
import type { Field } from '../src/fields/entities/field.entity';
import { Slot } from '../src/slots/entities/slot.entity';
import { SlotStatus } from '../src/slots/slot-status.enum';
import { login, mintCookie, type SessionCookie } from './support/auth';
import { API, TENANT_A, TENANT_B } from './support/constants';
import { createTestApp, type TestContext } from './support/create-test-app';
import { autumnDstChange, iso, upcomingMonday } from './support/dates';
import { resetDomainTables } from './support/db';
import { expectError, expectValidationError } from './support/expect';
import { asTenant, createContact, createField, createRawSlot } from './support/fixtures';

/** A Monday 18:00 Prague, a week or two out — the API rejects a start in the past. */
const START = upcomingMonday(18);
const FROM = iso(START);

/** START shifted by whole minutes (or weeks), as a Date. */
const at = (minutes: number) => START.plus({ minutes }).toJSDate();
const weeksAfterStart = (weeks: number) => iso(START.plus({ weeks }));

/** A search window covering START's whole day. */
const DAY = { from: iso(START.startOf('day')), to: iso(START.plus({ days: 1 }).startOf('day')) };

describe('bookings (e2e)', () => {
  let ctx: TestContext;
  let cookie: SessionCookie;
  let contact: Contact;
  let field: Field;
  let pitchA: string;
  let pitchB: string;

  const http = () => request(ctx.app.getHttpServer());

  const post = (overrides: Record<string, unknown> = {}) =>
    http()
      .post(`${API}/bookings`)
      .set('Cookie', cookie)
      .send({
        name: 'Weekly training',
        from: FROM,
        duration: 90,
        price: 1200,
        isWholeField: false,
        contactId: contact.id,
        fieldId: field.id,
        ...overrides,
      });

  beforeAll(async () => {
    ctx = await createTestApp();
    cookie = await login(ctx.app);
  });

  afterAll(() => ctx.close());

  beforeEach(async () => {
    await resetDomainTables(ctx.orm);
    contact = await createContact(ctx.orm, { email: 'booker@example.com' });
    field = await createField(ctx.orm, 'North Field', ['A', 'B']);
    [pitchA, pitchB] = field.pitches.getItems().map((pitch) => pitch.id);
  });

  describe('POST /bookings — shape', () => {
    it('creates a single session with the full slot contract', async () => {
      const res = await post();

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'Weekly training',
        contact: {
          id: contact.id,
          firstName: 'Jan',
          lastName: 'Novák',
          email: 'booker@example.com',
          phone: null,
          show: true,
        },
        slots: [
          {
            id: expect.any(String),
            name: 'Weekly training',
            from: FROM,
            to: at(90).toISOString(),
            // numeric comes out of pg as a string; the DTO is contracted to a number.
            price: 1200,
            pitchId: pitchA,
            bookingId: expect.any(String),
            status: SlotStatus.Booked,
            cancellationReason: null,
          },
        ],
      });
    });

  });

  describe('POST /bookings — weekly expansion', () => {
    it('expands to one session per week', async () => {
      const res = await post({ endDate: weeksAfterStart(3) });

      expect(res.status).toBe(201);
      expect(res.body.slots.map((s: { from: string }) => s.from)).toEqual(
        [0, 1, 2, 3].map(weeksAfterStart),
      );
      // A half-field series reuses one pitch across non-overlapping weeks.
      expect(new Set(res.body.slots.map((s: { pitchId: string }) => s.pitchId))).toEqual(
        new Set([pitchA]),
      );
    });

    it('keeps the local wall-clock time across the autumn DST change', async () => {
      // 18:00 Prague is 16:00Z under CEST and 17:00Z under CET. Re-run end to end because
      // this exercises the real tstzrange round trip, not just the formatter.
      const change = autumnDstChange(18);
      const res = await post({ from: iso(change.minus({ weeks: 1 })), endDate: iso(change) });

      expect(res.status).toBe(201);
      const [first, second] = res.body.slots.map((s: { from: string }) => Date.parse(s.from));
      expect(second - first).toBe((7 * 24 + 1) * 60 * 60 * 1000);
    });

    it('rejects a series that ends before it starts', async () => {
      const res = await post({ endDate: weeksAfterStart(-1) });

      // A service BadRequestException with a string payload — no `errors` array.
      expectError(res, 400, 'The series cannot end before it starts');
    });

    it('allows 52 sessions and rejects 53', async () => {
      const ok = await post({ endDate: weeksAfterStart(51) });
      expect(ok.status).toBe(201);
      expect(ok.body.slots).toHaveLength(52);

      await resetDomainTables(ctx.orm);
      contact = await createContact(ctx.orm, { email: 'booker@example.com' });
      field = await createField(ctx.orm, 'North Field', ['A', 'B']);

      const tooMany = await post({ endDate: weeksAfterStart(52) });
      expectError(tooMany, 400, 'A series may not exceed 52 sessions (requested: 53)');
    });

    // Not covered: expandWeekly() also rejects a local time that doesn't exist on a
    // spring-forward day. Reaching it means booking between 02:00 and 03:00, outside the
    // 08:00–22:00 opening hours, so the hours check rejects such a start first.
  });

  describe('POST /bookings — time rules', () => {
    const OUTSIDE_HOURS = 'Sessions must start at 08:00 or later and end by 22:00';
    const localTime = (hour: number, minute = 0) => iso(START.set({ hour, minute }));

    it('rejects a first session in the past', async () => {
      expectError(
        await post({ from: weeksAfterStart(-3) }),
        400,
        'A booking cannot start in the past',
      );
    });

    it('accepts a session starting at 08:00', async () => {
      expect((await post({ from: localTime(8), duration: 60 })).status).toBe(201);
    });

    it('accepts a session ending at 22:00', async () => {
      expect((await post({ from: localTime(20), duration: 120 })).status).toBe(201);
    });

    it('rejects a session starting before 08:00', async () => {
      expectError(await post({ from: localTime(7, 59), duration: 60 }), 400, OUTSIDE_HOURS);
    });

    it('rejects a session ending after 22:00', async () => {
      expectError(await post({ from: localTime(21), duration: 90 }), 400, OUTSIDE_HOURS);
    });
  });

  describe('POST /bookings — allocation', () => {
    it('books every pitch for a whole-field session', async () => {
      const res = await post({ isWholeField: true });

      expect(res.status).toBe(201);
      expect(res.body.slots).toHaveLength(2);
      expect(new Set(res.body.slots.map((s: { pitchId: string }) => s.pitchId))).toEqual(
        new Set([pitchA, pitchB]),
      );
    });

    it('falls through to the free pitch when one is taken for the same period', async () => {
      await createRawSlot(ctx.orm, {
        pitchId: pitchA,
        from: at(0),
        to: at(90),
      });

      const res = await post();

      expect(res.status).toBe(201);
      expect(res.body.slots[0].pitchId).toBe(pitchB);
    });

    it('409s when every pitch is taken', async () => {
      for (const pitchId of [pitchA, pitchB]) {
        await createRawSlot(ctx.orm, {
          pitchId,
          from: at(0),
          to: at(90),
        });
      }

      expectError(await post(), 409, `No pitch is available at ${FROM}`);
    });

    it('409s when an overlapping booking has a different period', async () => {
      await createRawSlot(ctx.orm, {
        pitchId: pitchA,
        from: at(30),
        to: at(120),
      });

      expectError(await post(), 409, /must start and end at the same time/);
    });

    it('409s a whole-field booking when any pitch is occupied', async () => {
      await createRawSlot(ctx.orm, {
        pitchId: pitchA,
        from: at(0),
        to: at(90),
      });

      expectError(await post({ isWholeField: true }), 409, `The field is not free at ${FROM}`);
    });

    it('ignores cancelled slots when allocating', async () => {
      await createRawSlot(ctx.orm, {
        pitchId: pitchA,
        from: at(0),
        to: at(90),
        status: SlotStatus.Cancelled,
      });

      const res = await post();

      expect(res.status).toBe(201);
      expect(res.body.slots[0].pitchId).toBe(pitchA);
    });
  });

  describe('POST /bookings — validation and lookups', () => {
    it('validates the body', async () => {
      expectValidationError(
        await post({ duration: 45 }),
        'duration must be one of the following values: 60, 90, 120',
      );
      expectValidationError(await post({ price: -1 }), 'price must not be less than 0');
      expectValidationError(await post({ from: 'yesterday' }), 'from must be a Date instance');
      expectValidationError(await post({ name: '' }), 'name should not be empty');
      expectValidationError(await post({ contactId: 'abc' }), 'contactId must be a UUID');
    });

    it('rejects unknown keys', async () => {
      expectValidationError(
        await post({ notes: 'bring cones' }),
        'property notes should not exist',
      );
    });

    it('404s on an unknown contact or field, checking the contact first', async () => {
      const missing = '11111111-1111-4111-8111-111111111111';

      expectError(await post({ contactId: missing }), 404, /^Contact .* not found$/);
      expectError(await post({ fieldId: missing }), 404, /^Field .* not found$/);
      // Both unknown: the contact lookup runs first, so its message is the one that wins.
      expectError(
        await post({ contactId: missing, fieldId: missing }),
        404,
        /^Contact .* not found$/,
      );
    });
  });

  describe('POST /bookings — documented-vs-actual gaps', () => {
    it('returns 201 with no slots for a whole-field booking on a pitchless field (Swagger documents a 400)', async () => {
      const empty = await createField(ctx.orm, 'Pitchless', []);

      const res = await post({ fieldId: empty.id, isWholeField: true });

      // bookings.swagger.ts promises a 400 for "the field has no pitches", but no such
      // check exists: the cross product of sessions and zero pitches is simply empty.
      expect(res.status).toBe(201);
      expect(res.body.slots).toEqual([]);
    });

    it('409s a half-field booking on a pitchless field — a different branch from the above', async () => {
      const empty = await createField(ctx.orm, 'Pitchless', []);

      expectError(
        await post({ fieldId: empty.id, isWholeField: false }),
        409,
        /^No pitch is available at /,
      );
    });

    it('surfaces an exclusion-constraint violation as a 500, not a 409', async () => {
      const single = await createField(ctx.orm, 'Single Pitch', ['Only']);
      const [onlyPitch] = single.pitches.getItems();

      // Owned by another tenant. findOccupied() scopes by getCurrentTenantId() because
      // QueryBuilder bypasses TENANT_FILTER, so this slot is invisible to the allocator —
      // but ck_slots_no_overlap is tenant-agnostic, so the INSERT raises SQLSTATE 23P01.
      await createRawSlot(ctx.orm, {
        tenantId: TENANT_B,
        pitchId: onlyPitch.id,
        from: at(0),
        to: at(90),
      });

      // AllExceptionsFilter special-cases 23505 only, so 23P01 falls through to the 500.
      expectError(await post({ fieldId: single.id }), 500, 'Internal server error');
    });
  });

  describe('GET /bookings', () => {
    const search = (query: Record<string, string>) =>
      http().get(`${API}/bookings`).query(query).set('Cookie', cookie);

    it('finds a booking whose slot starts inside the window', async () => {
      await post().expect(201);

      const res = await search(DAY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].contact.id).toBe(contact.id);
    });

    it('returns every slot of a matching booking, not just the ones in the window', async () => {
      await post({ endDate: weeksAfterStart(2) }).expect(201);

      // A window covering only week 1 — populateWhere: PopulateHint.ALL means the booking
      // still comes back with all three slots.
      const res = await search(DAY);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].slots).toHaveLength(3);
    });

    it('filters by contact', async () => {
      const other = await createContact(ctx.orm, { email: 'other@example.com' });
      await post().expect(201);

      expect((await search({ ...DAY, contactId: other.id })).body).toEqual([]);
      expect((await search({ ...DAY, contactId: contact.id })).body).toHaveLength(1);
    });

    it('excludes cancelled slots unless asked, coercing the string flag', async () => {
      const created = await post().expect(201);
      const slotId = created.body.slots[0].id;

      await asTenant(ctx.orm, TENANT_A, async (em) => {
        const slot = await em.findOneOrFail(Slot, { id: slotId });
        slot.status = SlotStatus.Cancelled;
        await em.flush();
      });

      expect((await search(DAY)).body).toEqual([]);
      // Query strings are always strings; the DTO's @Transform turns 'true' into true.
      expect((await search({ ...DAY, includeCancelled: 'true' })).body).toHaveLength(1);
    });

    it('treats the window bounds as inclusive on the slot start', async () => {
      await post().expect(201);

      // from == the slot's exact start ($gte).
      expect((await search({ from: FROM, to: DAY.to })).body).toHaveLength(1);
      // to one millisecond before the start excludes it.
      expect(
        (await search({ from: DAY.from, to: iso(START.minus({ milliseconds: 1 })) })).body,
      ).toEqual([]);
    });

    it('validates the query', async () => {
      expectValidationError(
        await http().get(`${API}/bookings`).set('Cookie', cookie),
        'from must be a Date instance',
        'to must be a Date instance',
      );
      expectValidationError(
        await search({ from: FROM, to: FROM, foo: '1' }),
        'property foo should not exist',
      );
      expectValidationError(
        await search({ from: FROM, to: FROM, contactId: 'abc' }),
        'contactId must be a UUID',
      );
      expectValidationError(
        await search({ from: DAY.to, to: DAY.from }),
        'to must not be before from',
      );
    });
  });

  describe('tenancy', () => {
    it('hides another tenant bookings', async () => {
      await post().expect(201);

      const res = await http()
        .get(`${API}/bookings`)
        .query(DAY)
        .set('Cookie', mintCookie(ctx.app, { tenantId: TENANT_B }))
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('404s before any conflict check when the contact belongs to another tenant', async () => {
      const res = await http()
        .post(`${API}/bookings`)
        .set('Cookie', mintCookie(ctx.app, { tenantId: TENANT_B }))
        .send({
          name: 'Weekly training',
          from: FROM,
          duration: 90,
          price: 1200,
          isWholeField: false,
          contactId: contact.id,
          fieldId: field.id,
        });

      expectError(res, 404, /^Contact .* not found$/);
    });
  });
});
