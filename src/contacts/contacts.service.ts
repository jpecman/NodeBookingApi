import { randomUUID } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getCurrentTenantId } from '../common/tenancy/tenant-context';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Contact } from './entities/contact.entity';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    @InjectRepository(Contact)
    private readonly contacts: Repository<Contact>,
  ) {}

  async create(dto: CreateContactDto): Promise<Contact> {
    // tenantId is stamped by TenantSubscriber.beforeInsert() from the request's tenant
    // context, not set here.
    const contact = this.contacts.create({
      id: randomUUID(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email ?? '',
      phone: dto.phone ?? '',
      show: dto.show ?? false,
    });

    // A duplicate email raises a Postgres 23505 here; AllExceptionsFilter turns
    // that into a 409 rather than letting it bubble up as a 500.
    const saved = await this.contacts.save(contact);
    this.logger.log(`Created contact ${saved.id}`);

    return saved;
  }

  findAll(): Promise<Contact[]> {
    return this.contacts.find({
      where: { tenantId: getCurrentTenantId() },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Contact> {
    const contact = await this.contacts.findOneBy({ id, tenantId: getCurrentTenantId() });

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

    const saved = await this.contacts.save(contact);
    this.logger.log(`Updated contact ${id}`);

    return saved;
  }

  async remove(id: string): Promise<void> {
    // Bookings.ContactId cascades on delete in the shared BookingApi schema, so this
    // also deletes that contact's bookings.
    const result = await this.contacts.delete({ id, tenantId: getCurrentTenantId() });

    if (!result.affected) {
      this.logger.warn(`Contact ${id} not found`);
      throw new NotFoundException(`Contact ${id} not found`);
    }

    this.logger.log(`Deleted contact ${id}`);
  }
}
