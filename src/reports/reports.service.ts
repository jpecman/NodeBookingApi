import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, raw } from '@mikro-orm/postgresql';
import type { Contact } from '../contacts/entities/contact.entity';
import { ContactResponseDto } from '../contacts/dto/contact-response.dto';
import { BOOKING_CONTEXT } from '../database/mikro-orm.options';
import { Slot } from '../slots/entities/slot.entity';
import { SlotStatus } from '../slots/slot-status.enum';
import { parseTstzRange } from '../slots/tstzrange';
import { ContactBookingResponseDto } from './dto/contact-booking-response.dto';
import { SearchReportsDto } from './dto/search-report.dto';

/** What one contact's slots add up to while the rows are being folded together. */
interface Aggregate {
  contact: Contact;
  bookingIds: Set<string>;
  totalPrice: number;
  earliest: Date;
  latest: Date;
  status: SlotStatus;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Slot, BOOKING_CONTEXT)
    private readonly slots: EntityRepository<Slot>,
  ) {}

  /**
   * BookingApi's BookingManager.GetGroupedByContactAsync: every non-cancelled slot lying
   * entirely inside [from, to], grouped by the contact its booking belongs to.
   *
   * This is a slot-level query on purpose — BookingsService.findAll is booking-level and
   * populates every slot of a matching booking (PopulateHint.ALL), which the calendar
   * wants and a sum does not.
   */
  async contactBookings(search: SearchReportsDto): Promise<ContactBookingResponseDto[]> {
    const slots = await this.slots.find(
      {
        // Duration is a tstzrange; BookingApi's summary counts a slot only when the whole
        // range is inside the window, not merely its start. The callback gets the alias
        // MikroORM gave the Slots table.
        [raw((alias) => `lower(${alias}."Duration")`)]: { $gte: search.from },
        [raw((alias) => `upper(${alias}."Duration")`)]: { $lte: search.to },
        status: { $ne: SlotStatus.Cancelled },
      },
      // TENANT_FILTER scopes the slots and, as they're populated, the bookings and
      // contacts too — no explicit tenantId needed outside QueryBuilder.
      { populate: ['booking.contact'] },
    );

    const byContact = new Map<string, Aggregate>();

    for (const slot of slots) {
      const booking = slot.booking.getEntity();
      const contact = booking.contact.getEntity();
      // Price is pg numeric, so it arrives as a string — adding the strings would
      // concatenate them.
      const price = Number(slot.price);
      const { from, to } = parseTstzRange(slot.duration);
      const aggregate = byContact.get(contact.id);

      if (!aggregate) {
        byContact.set(contact.id, {
          contact,
          // A contact's slots span several bookings; the count is of bookings, not slots.
          bookingIds: new Set([booking.id]),
          totalPrice: price,
          earliest: from,
          latest: to,
          status: slot.status,
        });
        continue;
      }

      aggregate.bookingIds.add(booking.id);
      aggregate.totalPrice += price;
      if (from < aggregate.earliest) aggregate.earliest = from;
      if (to > aggregate.latest) aggregate.latest = to;
      // Lowest enum value wins, so one unpaid slot keeps the row at Booked.
      if (slot.status < aggregate.status) aggregate.status = slot.status;
    }

    this.logger.log(`${slots.length} slots across ${byContact.size} contacts`);

    return [...byContact.values()].map((aggregate) => ({
      contact: ContactResponseDto.fromEntity(aggregate.contact),
      bookingCount: aggregate.bookingIds.size,
      totalPrice: aggregate.totalPrice,
      earliestBookingDate: aggregate.earliest,
      latestBookingDate: aggregate.latest,
      status: aggregate.status,
    }));
  }
}
