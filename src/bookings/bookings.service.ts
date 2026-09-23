import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { PopulateHint } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository, raw } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { getCurrentTenantId } from '../common/tenancy/tenant-context';
import { ContactsService } from '../contacts/contacts.service';
import { FieldsService } from '../fields/fields.service';
import { Pitch } from '../pitches/entities/pitch.entity';
import { Slot } from '../slots/entities/slot.entity';
import { SlotStatus } from '../slots/slot-status.enum';
import { formatTstzRange, parseTstzRange } from '../slots/tstzrange';
import { CreateBookingDto } from './dto/create-booking.dto';
import { SearchBookingsDto } from './dto/search-booking.dto';
import { Booking } from './entities/bookings.entity';

const VENUE_ZONE = 'Europe/Prague'; // BookingApi: appsettings.json → Venue:TimeZone
const MAX_OCCURRENCES = 52; // BookingApi: WeeklyRecurrence.MaxOccurences
// Opening hours, venue-local: a session starts at OPENS or later and ends by CLOSES.
const OPENS = { hour: 8, minute: 0 };
const CLOSES = { hour: 22, minute: 0 };

interface Period {
  from: Date;
  to: Date;
}
interface Allocation extends Period {
  pitchId: string;
}

// Ranges are half-open [from, to), same as Postgres's && operator.
const overlaps = (a: Period, b: Period) => a.from < b.to && b.from < a.to;
const samePeriod = (a: Period, b: Period) =>
  a.from.getTime() === b.from.getTime() && a.to.getTime() === b.to.getTime();

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookings: EntityRepository<Booking>,
    private readonly em: EntityManager,
    private readonly contactsService: ContactsService,
    private readonly fieldsService: FieldsService,
  ) {}

  /**
   * Bookings with at least one slot starting within [from, to] (both inclusive) — and,
   * unless includeCancelled, that slot isn't cancelled. Each booking comes back with its
   * contact and *all* of its slots; the slot conditions only decide which bookings match.
   * Tenant scoping comes from TENANT_FILTER on Booking (and on Contact/Slot as they're
   * populated).
   */
  async findAll(search: SearchBookingsDto): Promise<Booking[]> {
    const bookings = await this.bookings.find(
      {
        // A nested condition on a collection means "has at least one slot that…"; MikroORM
        // joins Slots for it.
        slots: {
          // Duration is a tstzrange; its lower bound is the slot's start. The callback gets
          // the alias MikroORM gave the joined Slots table.
          [raw((alias) => `lower(${alias}.duration)`)]: { $gte: search.from, $lte: search.to },
          // Optional conditions are spread in only when they apply, so an absent filter
          // adds nothing to the WHERE clause.
          ...(search.includeCancelled ? {} : { status: { $ne: SlotStatus.Cancelled } }),
        },
        ...(search.contactId ? { contact: search.contactId } : {}),
      },
      {
        populate: ['contact', 'slots'],
        // Load every slot of a matching booking, not just the ones matching `where`.
        populateWhere: PopulateHint.ALL,
      },
    );

    this.logger.log(`bookings count: ${bookings.length}`);

    return bookings;
  }

  async create(dto: CreateBookingDto): Promise<Booking> {
    await this.contactsService.findOne(dto.contactId); // throws NotFoundException
    const field = await this.fieldsService.findOne(dto.fieldId);
    const pitches = field.pitches.getItems();

    // 2–4.
    const sessions = this.expandWeekly(dto);
    const occupied = await this.findOccupied(field.id, sessions);
    const allocations = dto.isWholeField
      ? this.allocateWholeField(pitches, sessions, occupied)
      : this.allocateHalfField(pitches, sessions, occupied);

    // 5. Slots given inline become entities too, with `booking` set from the collection,
    // and the default persist cascade means one flush inserts the booking and all its
    // slots — in a single transaction, so a failed slot insert can't leave an empty
    // booking behind. tenantId is filled on every row by the entities' onCreate hook.
    const booking = this.bookings.create({
      name: dto.name,
      contact: dto.contactId, // a primary key is enough for a relation
      slots: allocations.map(({ pitchId, from, to }) => ({
        name: dto.name, // slot names mirror the booking name
        duration: formatTstzRange(from, to),
        price: dto.price.toString(),
        pitch: pitchId,
        status: SlotStatus.Booked,
      })),
    });

    await this.em.flush();
    this.logger.log(`Created booking ${booking.id} with ${allocations.length} slots`);

    // 6. `slots` is already filled in; `contact` is only a reference until populated.
    return this.em.populate(booking, ['contact']);
  }

  /** WeeklyRecurrence.Create + Expand. */
  private expandWeekly(dto: CreateBookingDto): Period[] {
    const first = DateTime.fromJSDate(dto.from, { zone: VENUE_ZONE });

    // Checking the first session covers the series: later weeks start later, at the same
    // local time and for the same duration (the DST check below rejects any shift).
    if (first < DateTime.now()) {
      throw new BadRequestException('A booking cannot start in the past');
    }
    const time = { second: 0, millisecond: 0 };
    if (
      first < first.set({ ...OPENS, ...time }) ||
      first.plus({ minutes: dto.duration }) > first.set({ ...CLOSES, ...time })
    ) {
      throw new BadRequestException('Sessions must start at 08:00 or later and end by 22:00');
    }

    const firstDay = first.startOf('day');
    const lastDay = DateTime.fromJSDate(dto.endDate ?? dto.from, { zone: VENUE_ZONE }).startOf(
      'day',
    );

    if (lastDay < firstDay) {
      throw new BadRequestException('The series cannot end before it starts');
    }

    const count = Math.floor(Math.round(lastDay.diff(firstDay, 'days').days) / 7) + 1;
    if (count > MAX_OCCURRENCES) {
      throw new BadRequestException(
        `A series may not exceed ${MAX_OCCURRENCES} sessions (requested: ${count})`,
      );
    }

    return Array.from({ length: count }, (_, i) => {
      // Calendar arithmetic: keeps the local time across DST changes.
      const start = first.plus({ weeks: i });

      // Luxon moves a nonexistent local time (spring-forward gap) forward instead of
      // failing; BookingApi rejects it, so detect the shift.
      if (start.hour !== first.hour || start.minute !== first.minute) {
        throw new BadRequestException(
          `${first.toFormat('HH:mm')} does not exist on ${start.toISODate()} in ${VENUE_ZONE}`,
        );
      }

      return { from: start.toJSDate(), to: start.plus({ minutes: dto.duration }).toJSDate() };
    });
  }

  /** SlotGateway.GetExistingSlotsForDaysAsync. */
  private async findOccupied(fieldId: string, sessions: Period[]): Promise<Allocation[]> {
    const slots = await this.em
      .createQueryBuilder(Slot, 'slot')
      // The primary key has to be in the projection: getResultList() maps rows onto Slot
      // entities, and MikroORM refuses to materialise one without its identifier.
      .select(['id', 'pitch', 'duration'])
      .where({
        pitch: { field: fieldId }, // joins Pitch automatically
        // QueryBuilder doesn't apply TENANT_FILTER, so scope it explicitly.
        tenantId: getCurrentTenantId(),
        status: { $ne: SlotStatus.Cancelled },
      })
      .andWhere('slot.duration && tstzrange(?, ?)', [
        sessions[0].from,
        sessions[sessions.length - 1].to,
      ])
      .getResultList();

    // Duration comes back as the raw range literal; `pitch` is an unloaded reference
    // whose id is known.
    return slots.map((slot) => ({ pitchId: slot.pitch.id, ...parseTstzRange(slot.duration) }));
  }

  /** FieldAllocator.WholeField: every pitch, and nothing else may overlap. */
  private allocateWholeField(
    pitches: Pitch[],
    sessions: Period[],
    occupied: Allocation[],
  ): Allocation[] {
    for (const session of sessions) {
      if (occupied.some((o) => overlaps(o, session))) {
        throw new ConflictException(`The field is not free at ${session.from.toISOString()}`);
      }
    }
    return sessions.flatMap((session) =>
      pitches.map((pitch) => ({ pitchId: pitch.id, ...session })),
    );
  }

  /** FieldAllocator.HalfField: first free pitch; sharing requires an identical period. */
  private allocateHalfField(
    pitches: Pitch[],
    sessions: Period[],
    occupied: Allocation[],
  ): Allocation[] {
    // Grows as we go, so two overlapping sessions of this booking can't get the same pitch.
    const taken = [...occupied];

    return sessions.map((session) => {
      const overlapping = taken.filter((o) => overlaps(o, session));

      if (overlapping.some((o) => !samePeriod(o, session))) {
        throw new ConflictException(
          `A half-field booking at ${session.from.toISOString()} must start and end at ` +
            'the same time as the booking already on this field',
        );
      }

      const busy = new Set(overlapping.map((o) => o.pitchId));
      const free = pitches.find((pitch) => !busy.has(pitch.id));
      if (!free) {
        throw new ConflictException(`No pitch is available at ${session.from.toISOString()}`);
      }

      const allocation = { pitchId: free.id, ...session };
      taken.push(allocation);
      return allocation;
    });
  }
}
