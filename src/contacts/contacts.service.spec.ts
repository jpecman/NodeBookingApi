import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactsService } from './contacts.service';
import { Contact } from './entities/contact.entity';

/**
 * The one test: it demonstrates Nest's testing idiom — build a module, swap the real
 * repository for a mock via its injection token — and pins the 404 contract that
 * AllExceptionsFilter depends on. No database involved.
 */
describe('ContactsService', () => {
  let service: ContactsService;
  const repository = { findOneBy: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [ContactsService, { provide: getRepositoryToken(Contact), useValue: repository }],
    }).compile();

    service = moduleRef.get(ContactsService);
  });

  it('throws NotFoundException when the contact does not exist', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('6f9d3f1e-0000-4000-8000-000000000000')).rejects.toThrow(
      NotFoundException,
    );
  });
});
