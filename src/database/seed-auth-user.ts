import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { config as loadDotenv } from 'dotenv';
import { MikroORM } from '@mikro-orm/postgresql';
import { DEFAULT_TENANT_ID } from '../common/constants/tenant';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user-role.enum';
import { createOrmOptions } from './mikro-orm.options';

// Runs outside Nest, so it gets no ConfigModule and no direnv guarantee — load .env
// explicitly here.
loadDotenv();

const BCRYPT_ROUNDS = 10;

/**
 * Standalone provisioning script — there are no registration or admin endpoints, so this
 * is how accounts get created. Run via `npm run seed:auth-user`.
 */
async function seed(): Promise<void> {
  const email = process.env.SEED_EMAIL ?? 'admin@nodebooking.local';
  const password = process.env.SEED_PASSWORD ?? 'ChangeMe123!';
  const role = (process.env.SEED_ROLE as UserRole | undefined) ?? UserRole.Administrator;

  const orm = await MikroORM.init({
    ...createOrmOptions({ clientUrl: process.env.DATABASE_URL }),
    entities: [User],
  });

  try {
    // Outside a request there's no RequestContext, so work on an explicit fork.
    const em = orm.em.fork();
    const existing = await em.findOne(User, { email });

    if (existing) {
      console.log(`User ${email} already exists, skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    em.create(User, { email, passwordHash, role, tenantId: DEFAULT_TENANT_ID });
    await em.flush();

    console.log(`Seeded user ${email} (role: ${role}, tenant: ${DEFAULT_TENANT_ID}).`);
  } finally {
    await orm.close(true);
  }
}

seed().catch((error: unknown) => {
  console.error('Failed to seed auth user:', error);
  process.exitCode = 1;
});
