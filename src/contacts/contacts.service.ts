import { randomUUID } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@mikro-orm/nestjs';
import { EntityManager, EntityRepository } from '@mikro-orm/postgresql';
import { BOOKING_CONTEXT } from '../database/mikro-orm.options';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Contact } from './entities/contact.entity';

/**
 * Tenant scoping is implicit here: Contact carries TENANT_FILTER, so every find and
 * nativeDelete below is already limited to the request's tenant, and onCreate fills
 * tenantId on insert.
 */
@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    @InjectRepository(Contact, BOOKING_CONTEXT)
    private readonly contacts: EntityRepository<Contact>,
    @InjectEntityManager(BOOKING_CONTEXT)
    private readonly em: EntityManager,
  ) {}

  async create(dto: CreateContactDto): Promise<Contact> {
    // create() only schedules the insert; flush() runs it.
    const contact = this.contacts.create({
      id: randomUUID(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email ?? '',
      phone: dto.phone ?? '',
      show: dto.show ?? false,
    });

    // A duplicate email raises UniqueConstraintViolationException here;
    // AllExceptionsFilter turns that into a 409 rather than letting it bubble up as a 500.
    await this.em.flush();
    this.logger.log(`Created contact ${contact.id}`);

    return contact;
  }

  findAll(): Promise<Contact[]> {
    return this.contacts.findAll({ orderBy: { lastName: 'asc', firstName: 'asc' } });
  }

  async findOne(id: string): Promise<Contact> {
    const contact = await this.contacts.findOne({ id });

    if (!contact) {
      this.logger.warn(`Contact ${id} not found`);
      throw new NotFoundException(`Contact ${id} not found`);
    }

    return contact;
  }

  async update(id: string, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.findOne(id);

    // Only assign what the caller actually sent — an absent key must not clear a
    // column. email/phone go through '' (their NOT NULL "empty" encoding) rather
    // than null, since the underlying column can't hold null.
    const { email, phone, ...rest } = dto;
    Object.assign(contact, rest);
    if ('email' in dto) contact.email = email ?? '';
    if ('phone' in dto) contact.phone = phone ?? '';

    // No save(): findOne() left the contact tracked, so flush() issues an UPDATE for
    // exactly the columns that changed (or nothing, if none did).
    await this.em.flush();
    this.logger.log(`Updated contact ${id}`);

    return contact;
  }

  async remove(id: string): Promise<void> {
    // A single DELETE, bypassing the unit of work. Bookings.ContactId cascades on
    // delete in the shared BookingApi schema, so this also deletes that contact's bookings.
    const affected = await this.contacts.nativeDelete({ id });

    if (!affected) {
      this.logger.warn(`Contact ${id} not found`);
      throw new NotFoundException(`Contact ${id} not found`);
    }

    this.logger.log(`Deleted contact ${id}`);
  }
}
