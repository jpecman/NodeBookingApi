import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DEFAULT_TENANT_ID } from '../common/constants/tenant';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user-role.enum';
import authDataSource from './auth-data-source';

const BCRYPT_ROUNDS = 10;

/**
 * Standalone provisioning script — BookingApi's admin-only account creation has no
 * equivalent here (no admin endpoints), so this is how local/test accounts get into the
 * auth database. Run via `npm run seed:auth-user`.
 */
async function seed(): Promise<void> {
  const email = process.env.SEED_EMAIL ?? 'admin@nodebooking.local';
  const password = process.env.SEED_PASSWORD ?? 'ChangeMe123!';
  const role = (process.env.SEED_ROLE as UserRole | undefined) ?? UserRole.Administrator;

  const dataSource = await authDataSource.initialize();

  try {
    const repository = dataSource.getRepository(User);
    const existing = await repository.findOneBy({ email });

    if (existing) {
      console.log(`User ${email} already exists, skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = repository.create({ email, passwordHash, role, tenantId: DEFAULT_TENANT_ID });
    await repository.save(user);

    console.log(`Seeded user ${email} (role: ${role}, tenant: ${DEFAULT_TENANT_ID}).`);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('Failed to seed auth user:', error);
  process.exitCode = 1;
});
