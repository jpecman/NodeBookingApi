import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from './entities/bookings.entity';
import { Repository } from 'typeorm';
import { getCurrentTenantId } from 'src/common/tenancy/tenant-context';
import { SearchBookingsDto } from './dto/search-booking.dto';
import { SlotStatus } from 'src/slots/slot-status.enum';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Field } from 'src/fields/entities/field.entity';
import { Slot } from 'src/slots/entities/slot.entity';
import { ContactsService } from 'src/contacts/contacts.service';
import { FieldsService } from 'src/fields/fields.service';
import { randomUUID } from 'crypto';
import { Pitch } from 'src/pitches/entities/pitch.entity';
import { DateTime } from 'luxon';

const VENUE_ZONE = 'Europe/Prague'; // BookingApi: appsettings.json → Venue:TimeZone
const MAX_OCCURRENCES = 52; // BookingApi: WeeklyRecurrence.MaxOccurences

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
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
    private readonly contactsService: ContactsService,
    private readonly fieldsService: FieldsService,
  ) {}

  findAll(search: SearchBookingsDto): Promise<Booking[]> {
    this.logger.error('test');
    const query = this.bookings
      .createQueryBuilder('booking')
      .innerJoinAndSelect('booking.contact', 'contact')
      .innerJoinAndSelect('booking.slots', 'slot')
      .where('booking.tenantId = :tenantId', { tenantId: getCurrentTenantId() });
    //   .andWhere('lower(slot.duration) >= :from', { from: search.from })
    //   .andWhere('lower(slot.duration) <= :to', { to: search.to });

    // if (!search.includeCancelled) {
    //   query.andWhere('slot.status != :cancelled', { cancelled: SlotStatus.Cancelled });
    // }
    // if (search.contactId) {
    //   query.andWhere('booking.contactId = :contactId', { contactId: search.contactId });
    // }

    return query.getMany();
  }

  async create(dto: CreateBookingDto): Promise<Booking> {
    const tenantId = getCurrentTenantId();

    const contact = await this.contactsService.findOne(dto.contactId); // throws NotFoundException
    const field = await this.fieldsService.findOne(dto.fieldId);

    // 2–4.
    const sessions = this.expandWeekly(dto);
    const occupied = await this.findOccupied(field.id, sessions);
    const allocations = dto.isWholeField
      ? this.allocateWholeField(field.pitches, sessions, occupied)
      : this.allocateHalfField(field.pitches, sessions, occupied);

    // 5. All or nothing: a failed slot insert must not leave an empty booking behind.
    const bookingId = randomUUID();
    await this.bookings.manager.transaction(async (em) => {
      await em.insert(Booking, {
        id: bookingId,
        name: dto.name,
        contactId: dto.contactId,
        tenantId,
      });
      await em.insert(
        Slot,
        allocations.map(({ pitchId, from, to }) => ({
          id: randomUUID(),
          name: dto.name, // BookingApi: slot names mirror the booking name
          duration: `[${from.toISOString()},${to.toISOString()})`,
          price: dto.price.toString(),
          pitchId,
          bookingId,
          status: SlotStatus.Booked,
          cancellationReason: null,
          tenantId,
        })),
      );
    });

    this.logger.log(`Created booking ${bookingId} with ${allocations.length} slots`);

    // 6.
    return this.bookings.findOneOrFail({
      where: { id: bookingId, tenantId },
      relations: { contact: true, slots: true },
    });
  }

  /** WeeklyRecurrence.Create + Expand. */
  private expandWeekly(dto: CreateBookingDto): Period[] {
    const first = DateTime.fromJSDate(dto.from, { zone: VENUE_ZONE });
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
  private findOccupied(fieldId: string, sessions: Period[]): Promise<Allocation[]> {
    return this.slots
      .createQueryBuilder('slot')
      .innerJoin('slot.pitch', 'pitch')
      .select('slot.pitchId', 'pitchId')
      .addSelect('lower(slot.duration)', 'from') // pg parses timestamptz → Date
      .addSelect('upper(slot.duration)', 'to')
      .where('pitch.fieldId = :fieldId', { fieldId })
      .andWhere('slot.tenantId = :tenantId', { tenantId: getCurrentTenantId() })
      .andWhere('slot.status != :cancelled', { cancelled: SlotStatus.Cancelled })
      .andWhere('slot.duration && tstzrange(:from, :to)', {
        from: sessions[0].from,
        to: sessions[sessions.length - 1].to,
      })
      .getRawMany<Allocation>();
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
