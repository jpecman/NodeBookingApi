import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { tenantContext } from '../common/tenancy/tenant-context';
import { ContactsService } from './contacts.service';
import { Contact } from './entities/contact.entity';

const TEST_TENANT_ID = '6f9d3f1e-0000-4000-8000-000000000001';

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

    // findOne() reads the tenant id via getCurrentTenantId(), which requires a request
    // context — normally populated by JwtStrategy.validate(), stubbed here directly.
    await tenantContext.run({ userId: 'test-user', tenantId: TEST_TENANT_ID }, async () => {
      await expect(service.findOne('6f9d3f1e-0000-4000-8000-000000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
