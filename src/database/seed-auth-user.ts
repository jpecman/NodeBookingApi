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
 * SEED_ROLE arrives as an arbitrary string; without this check a typo would be written to
 * the database as-is and silently match no @Roles() guard.
 */
function parseRole(value: string | undefined): UserRole {
  if (!value) {
    return UserRole.Administrator;
  }

  const roles = Object.values(UserRole);

  if (!roles.includes(value as UserRole)) {
    throw new Error(`SEED_ROLE must be one of ${roles.join(', ')} — got "${value}".`);
  }

  return value as UserRole;
}

/**
 * Standalone provisioning script — there are no registration or admin endpoints, so this
 * is how accounts get created. Run via `npm run seed:auth-user`.
 */
async function seed(): Promise<void> {
  const email = process.env.SEED_EMAIL ?? 'admin@nodebooking.local';

  // No default: a fallback password would be published in this repository, and running the
  // seed against a real database would then create an administrator anyone could log in as.
  const password = process.env.SEED_PASSWORD;

  if (!password) {
    throw new Error(
      'SEED_PASSWORD is not set. Add it to .env (or pass it inline) and run the seed again.',
    );
  }

  const role = parseRole(process.env.SEED_ROLE);

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
