import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { EntityManager } from '@mikro-orm/postgresql';
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
 * Times are written as UTC instants with the Prague local time noted, because the
 * recurrence is calendar arithmetic in Europe/Prague (VENUE_ZONE) and the DST cases are
 * the point of several tests.
 */

const CONTACT_ID = '11111111-1111-4111-8111-111111111111';
const FIELD_ID = '22222222-2222-4222-8222-222222222222';

const PITCH_A = { id: 'aaaaaaaa-0000-4000-8000-000000000000', name: 'A' } as Pitch;
const PITCH_B = { id: 'bbbbbbbb-0000-4000-8000-000000000000', name: 'B' } as Pitch;

/** Only getItems() is reached — create() never touches the rest of the entity. */
const fieldWith = (...pitches: Pitch[]) =>
  ({ id: FIELD_ID, pitches: { getItems: () => pitches } }) as Field;

/** A row as findOccupied's QueryBuilder returns it: an unloaded pitch ref and a raw range. */
const occupied = (pitch: Pitch, from: string, to: string) => ({
  pitch: { id: pitch.id },
  duration: formatTstzRange(new Date(from), new Date(to)),
});

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
    // 20:00 Prague (CEST, UTC+2).
    from: new Date('2026-09-21T18:00:00Z'),
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
      expect(parseTstzRange(slots[0].duration)).toEqual({
        from: new Date('2026-09-21T18:00:00Z'),
        to: new Date('2026-09-21T19:30:00Z'),
      });
      expect(slots[0]).toMatchObject({
        name: 'Weekly training',
        price: '1200',
        status: SlotStatus.Booked,
      });
      expect(em.flush).toHaveBeenCalledTimes(1);
    });

    it('creates one session per week up to endDate', async () => {
      await withTenant(() =>
        service.create(dtoFor({ endDate: new Date('2026-10-12T18:00:00Z') })),
      );

      const starts = createdSlots().map((slot) => parseTstzRange(slot.duration).from.toISOString());
      expect(starts).toEqual([
        '2026-09-21T18:00:00.000Z',
        '2026-09-28T18:00:00.000Z',
        '2026-10-05T18:00:00.000Z',
        '2026-10-12T18:00:00.000Z',
      ]);
    });

    it('keeps the local start time across the autumn DST change', async () => {
      // 18:00 Prague on 18 Oct is CEST (UTC+2); on 25 Oct the clocks have gone back, so
      // the same local time is CET (UTC+1) — an hour later in UTC.
      await withTenant(() =>
        service.create(
          dtoFor({
            from: new Date('2026-10-18T16:00:00Z'),
            endDate: new Date('2026-10-25T16:00:00Z'),
          }),
        ),
      );

      const starts = createdSlots().map((slot) => parseTstzRange(slot.duration).from.toISOString());
      expect(starts).toEqual(['2026-10-18T16:00:00.000Z', '2026-10-25T17:00:00.000Z']);
    });

    it('rejects a start time that does not exist on the spring DST change day', async () => {
      // 02:30 Prague on 22 Mar exists; a week later the clocks jump 02:00 -> 03:00.
      await expect(
        withTenant(() =>
          service.create(
            dtoFor({
              from: new Date('2026-03-22T01:30:00Z'),
              endDate: new Date('2026-03-29T01:30:00Z'),
            }),
          ),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a series that ends before it starts', async () => {
      await expect(
        withTenant(() => service.create(dtoFor({ endDate: new Date('2026-09-14T18:00:00Z') }))),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows exactly 52 sessions', async () => {
      // 51 weeks after the first session, so the first plus 51 more.
      await withTenant(() =>
        service.create(dtoFor({ endDate: new Date('2027-09-13T18:00:00Z') })),
      );

      expect(createdSlots()).toHaveLength(52);
    });

    it('rejects a series longer than 52 sessions', async () => {
      await expect(
        withTenant(() => service.create(dtoFor({ endDate: new Date('2027-09-20T18:00:00Z') }))),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('whole-field allocation', () => {
    it('books every pitch for each session', async () => {
      await withTenant(() =>
        service.create(
          dtoFor({ isWholeField: true, endDate: new Date('2026-09-28T18:00:00Z') }),
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
        occupied(PITCH_A, '2026-09-21T19:00:00Z', '2026-09-21T20:00:00Z'),
      ]);

      await expect(
        withTenant(() => service.create(dtoFor({ isWholeField: true }))),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('half-field allocation', () => {
    it('picks the free pitch when another booking shares the exact period', async () => {
      queryBuilder.getResultList.mockResolvedValue([
        occupied(PITCH_A, '2026-09-21T18:00:00Z', '2026-09-21T19:30:00Z'),
      ]);

      await withTenant(() => service.create(dtoFor()));

      expect(createdSlots().map((slot) => slot.pitch)).toEqual([PITCH_B.id]);
    });

    it('rejects sharing the field over a different period', async () => {
      queryBuilder.getResultList.mockResolvedValue([
        occupied(PITCH_A, '2026-09-21T18:30:00Z', '2026-09-21T19:00:00Z'),
      ]);

      await expect(withTenant(() => service.create(dtoFor()))).rejects.toThrow(ConflictException);
    });

    it('rejects when every pitch is taken for that period', async () => {
      queryBuilder.getResultList.mockResolvedValue([
        occupied(PITCH_A, '2026-09-21T18:00:00Z', '2026-09-21T19:30:00Z'),
        occupied(PITCH_B, '2026-09-21T18:00:00Z', '2026-09-21T19:30:00Z'),
      ]);

      await expect(withTenant(() => service.create(dtoFor()))).rejects.toThrow(ConflictException);
    });

    it('reuses the first pitch for sessions that do not overlap each other', async () => {
      await withTenant(() =>
        service.create(dtoFor({ endDate: new Date('2026-09-28T18:00:00Z') })),
      );

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
