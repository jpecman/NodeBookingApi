import { readFileSync } from 'fs';
import { HANDSHAKE_FILE, type Handshake } from './handshake';

const handshake = JSON.parse(readFileSync(HANDSHAKE_FILE, 'utf8')) as Handshake;

/**
 * This runs before the spec file's own imports, which is the only point early enough:
 * ConfigModule.forRoot() executes when src/app.module.ts is imported, not when the
 * testing module is compiled.
 *
 * Assignment, never ??=. A direnv shell has already exported the *development*
 * DATABASE_URL (.envrc does `dotenv_if_exists .env`), and @nestjs/config lets process.env
 * win over the .env file — so this line is the only thing standing between the suite and
 * TRUNCATEing the real database. db.ts asserts the same invariant before every reset.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = handshake.databaseUrl;
process.env.JWT_SECRET = handshake.jwtSecret;
process.env.JWT_EXPIRES_IN = '8h';
// Pinned for the same reason: auth-rate-limit.e2e-spec.ts counts attempts.
process.env.LOGIN_RATE_LIMIT = '5';
process.env.LOGIN_RATE_TTL = '60000';
