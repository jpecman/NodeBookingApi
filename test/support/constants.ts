import { DEFAULT_TENANT_ID } from '../../src/common/constants/tenant';

/** The account globalSetup provisions once, shared by every spec that just needs a session. */
export const ADMIN_EMAIL = 'e2e-admin@nodebooking.local';
export const ADMIN_PASSWORD = 'E2ePassword123!';

/**
 * bcrypt.compare takes its cost from the stored hash, so hashing fixtures at 4 rounds makes
 * every login in the suite ~5ms instead of ~80ms. Production hashing (seed-auth-user.ts,
 * AuthService) is untouched.
 */
export const FIXTURE_BCRYPT_ROUNDS = 4;

/** The one real tenant, the one every seeded row belongs to. */
export const TENANT_A = DEFAULT_TENANT_ID;

/**
 * A second tenant that exists only inside JWTs. There is no tenants table, and
 * JwtStrategy.validate() never looks the user up, so this needs no rows anywhere.
 */
export const TENANT_B = '9f2a7c11-0000-4000-8000-0000000000b2';

export const API = '/api/v1';
