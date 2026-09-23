import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/postgresql';
import { autumnDstChange, iso, upcomingMonday } from '../../test/support/dates';
import { DEFAULT_TENANT_ID } from '../common/constants/tenant';
import { tenantContext } from '../common/tenancy/tenant-context';
import { ContactsService } from '../contacts/contacts.service';
import type { Field } from '../fields/entities/field.entity';
import { FieldsService } from '../fields/fields.service';
import type { Pitch } from '../pitches/entities/pitch.entity';
import { SlotStatus } from '../slots/slot-status.enum';
import { formatTstzRange, parseTstzRange } from '../slots/tstzrange';
import { BookingsService } from './bookings.service';
import { BookingDuration, CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/bookings.entity';

/**
 * Covers create()'s three private stages — expandWeekly, findOccupied and the two
 * allocators — by asserting on what reaches repository.create(). No database: the
 * recurrence and allocation rules are pure functions of the DTO, the field's pitches and
 * the slots already on it.
 *
 * Times are Europe/Prague (VENUE_ZONE) wall-clock times relative to today, because the
 * recurrence is calendar arithmetic in that zone and a start in the past is rejected.
 */

const CONTACT_ID = '11111111-1111-4111-8111-111111111111';
const FIELD_ID = '22222222-2222-4222-8222-222222222222';

const PITCH_A = { id: 'aaaaaaaa-0000-4000-8000-000000000000', name: 'A' } as Pitch;
const PITCH_B = { id: 'bbbbbbbb-0000-4000-8000-000000000000', name: 'B' } as Pitch;

/** Only getItems() is reached — create() never touches the rest of the entity. */
const fieldWith = (...pitches: Pitch[]) =>
  ({ id: FIELD_ID, pitches: { getItems: () => pitches } }) as Field;

/** The default first session: 20:00 Prague, a week or two out. */
const START = upcomingMonday(20);

/** START shifted by whole minutes, as a Date. */
const at = (minutes: number) => START.plus({ minutes }).toJSDate();

/** A row as findOccupied's QueryBuilder returns it: an unloaded pitch ref and a raw range. */
const occupied = (pitch: Pitch, fromMinutes: number, toMinutes: number) => ({
  pitch: { id: pitch.id },
  duration: formatTstzRange(at(fromMinutes), at(toMinutes)),
});

const weeksAfterStart = (weeks: number) => START.plus({ weeks }).toJSDate();

/** The shape create() passes to repository.create(), which is what these tests assert on. */
interface CreatedSlot {
  name: string;
  duration: string;
  price: string;
  pitch: string;
  status: SlotStatus;
}

describe('BookingsService', () => {
  let service: BookingsService;

  const repository = { create: jest.fn(), find: jest.fn() };
  const em = { flush: jest.fn(), populate: jest.fn(), createQueryBuilder: jest.fn() };
  const queryBuilder = {
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getResultList: jest.fn(),
  };
  const contactsService = { findOne: jest.fn() };
  const fieldsService = { findOne: jest.fn() };

  /** getCurrentTenantId() throws outside a request context, so every call runs inside one. */
  const withTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantContext.run({ userId: 'user-1', tenantId: DEFAULT_TENANT_ID }, fn);

  const dtoFor = (overrides: Partial<CreateBookingDto> = {}): CreateBookingDto => ({
    name: 'Weekly training',
    from: START.toJSDate(),
    duration: BookingDuration.OneAndHalfHour,
    price: 1200,
    isWholeField: false,
    contactId: CONTACT_ID,
    fieldId: FIELD_ID,
    ...overrides,
  });

  const createdSlots = (): CreatedSlot[] =>
    (repository.create.mock.calls[0][0] as { slots: CreatedSlot[] }).slots;

  beforeEach(async () => {
    jest.resetAllMocks();

    queryBuilder.select.mockReturnThis();
    queryBuilder.where.mockReturnThis();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.getResultList.mockResolvedValue([]);

    em.createQueryBuilder.mockReturnValue(queryBuilder);
    em.populate.mockImplementation((entity: unknown) => Promise.resolve(entity));
    repository.create.mockImplementation((data: unknown) => data);

    contactsService.findOne.mockResolvedValue({ id: CONTACT_ID });
    fieldsService.findOne.mockResolvedValue(fieldWith(PITCH_A, PITCH_B));

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: repository },
        { provide: EntityManager, useValue: em },
        { provide: ContactsService, useValue: contactsService },
        { provide: FieldsService, useValue: fieldsService },
      ],
    }).compile();

    service = moduleRef.get(BookingsService);
  });

  describe('weekly expansion', () => {
    it('creates one session when endDate is omitted', async () => {
      await withTenant(() => service.create(dtoFor()));

      const slots = createdSlots();
      expect(slots).toHaveLength(1);
      expect(parseTstzRange(slots[0].duration)).toEqual({ from: at(0), to: at(90) });
      expect(slots[0]).toMatchObject({
        name: 'Weekly training',
        price: '1200',
        status: SlotStatus.Booked,
      });
      expect(em.flush).toHaveBeenCalledTimes(1);
    });

    it('creates one session per week up to endDate', async () => {
      await withTenant(() => service.create(dtoFor({ endDate: weeksAfterStart(3) })));

      const starts = createdSlots().map((slot) => parseTstzRange(slot.duration).from.toISOString());
      expect(starts).toEqual([0, 1, 2, 3].map((weeks) => iso(START.plus({ weeks }))));
    });

    it('keeps the local start time across the autumn DST change', async () => {
      // 18:00 Prague is CEST (UTC+2) the Sunday before and CET (UTC+1) on the change day —
      // the same local time an hour later in UTC.
      const change = autumnDstChange(18);
      await withTenant(() =>
        service.create(
          dtoFor({ from: change.minus({ weeks: 1 }).toJSDate(), endDate: change.toJSDate() }),
        ),
      );

      const [first, second] = createdSlots().map((slot) => parseTstzRange(slot.duration).from);
      expect(second.getTime() - first.getTime()).toBe((7 * 24 + 1) * 60 * 60 * 1000);
    });

    // The nonexistent-local-time check isn't covered: clocks only jump between 02:00 and
    // 03:00, outside opening hours, so the hours check rejects such a start first.

    it('rejects a series that ends before it starts', async () => {
      await expect(
        withTenant(() => service.create(dtoFor({ endDate: weeksAfterStart(-1) }))),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows exactly 52 sessions', async () => {
      // 51 weeks after the first session, so the first plus 51 more.
      await withTenant(() => service.create(dtoFor({ endDate: weeksAfterStart(51) })));

      expect(createdSlots()).toHaveLength(52);
    });

    it('rejects a series longer than 52 sessions', async () => {
      await expect(
        withTenant(() => service.create(dtoFor({ endDate: weeksAfterStart(52) }))),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('time rules', () => {
    const create = (from: Date, duration = BookingDuration.OneAndHalfHour) =>
      withTenant(() => service.create(dtoFor({ from, duration })));

    it('rejects a first session in the past', async () => {
      await expect(create(weeksAfterStart(-3))).rejects.toThrow(
        new BadRequestException('A booking cannot start in the past'),
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('accepts a session starting at 08:00 and one ending at 22:00', async () => {
      await create(START.set({ hour: 8 }).toJSDate());
      await create(START.set({ hour: 20 }).toJSDate(), BookingDuration.TwoHours);

      expect(repository.create).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['starts before 08:00', 7, 59, BookingDuration.OneHour],
      ['ends after 22:00', 21, 0, BookingDuration.OneAndHalfHour],
      ['runs past midnight', 23, 30, BookingDuration.OneHour],
    ])('rejects a session that %s', async (_, hour, minute, duration) => {
      await expect(create(START.set({ hour, minute }).toJSDate(), duration)).rejects.toThrow(
        new BadRequestException('Sessions must start at 08:00 or later and end by 22:00'),
      );
    });
  });

  describe('whole-field allocation', () => {
    it('books every pitch for each session', async () => {
      await withTenant(() =>
        service.create(
          dtoFor({ isWholeField: true, endDate: weeksAfterStart(1) }),
        ),
      );

      const slots = createdSlots();
      expect(slots).toHaveLength(4); // 2 sessions x 2 pitches
      expect(slots.map((slot) => slot.pitch)).toEqual([
        PITCH_A.id,
        PITCH_B.id,
        PITCH_A.id,
        PITCH_B.id,
      ]);
    });

    it('rejects when an existing slot overlaps, even on one pitch only', async () => {
      queryBuilder.getResultList.mockResolvedValue([
        occupied(PITCH_A, 60, 120),
      ]);

      await expect(
        withTenant(() => service.create(dtoFor({ isWholeField: true }))),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('half-field allocation', () => {
    it('picks the free pitch when another booking shares the exact period', async () => {
      queryBuilder.getResultList.mockResolvedValue([occupied(PITCH_A, 0, 90)]);

      await withTenant(() => service.create(dtoFor()));

      expect(createdSlots().map((slot) => slot.pitch)).toEqual([PITCH_B.id]);
    });

    it('rejects sharing the field over a different period', async () => {
      queryBuilder.getResultList.mockResolvedValue([
        occupied(PITCH_A, 30, 60),
      ]);

      await expect(withTenant(() => service.create(dtoFor()))).rejects.toThrow(ConflictException);
    });

    it('rejects when every pitch is taken for that period', async () => {
      queryBuilder.getResultList.mockResolvedValue([
        occupied(PITCH_A, 0, 90),
        occupied(PITCH_B, 0, 90),
      ]);

      await expect(withTenant(() => service.create(dtoFor()))).rejects.toThrow(ConflictException);
    });

    it('reuses the first pitch for sessions that do not overlap each other', async () => {
      await withTenant(() => service.create(dtoFor({ endDate: weeksAfterStart(1) })));

      // Weekly sessions never overlap, so the allocator's running `taken` list doesn't
      // push the second one onto another pitch.
      expect(createdSlots().map((slot) => slot.pitch)).toEqual([PITCH_A.id, PITCH_A.id]);
    });
  });

  describe('lookups', () => {
    it('checks the contact before the field', async () => {
      contactsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(withTenant(() => service.create(dtoFor()))).rejects.toThrow(NotFoundException);
      expect(fieldsService.findOne).not.toHaveBeenCalled();
    });

    it('scopes the occupied-slot lookup to the current tenant', async () => {
      // findOccupied uses QueryBuilder, which doesn't apply TENANT_FILTER — the condition
      // has to be there by hand.
      await withTenant(() => service.create(dtoFor()));

      expect(queryBuilder.where).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: DEFAULT_TENANT_ID }),
      );
    });
  });
});
