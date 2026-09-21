import { join } from 'path';

export interface Handshake {
  databaseUrl: string;
  jwtSecret: string;
  /** false when TEST_DATABASE_URL was supplied and no container was started. */
  usesContainer: boolean;
}

/**
 * How globalSetup (Jest's main process) tells the test workers where the database is.
 *
 * Workers do inherit process.env from the fork, but a file is the more robust channel:
 * setup-env.ts is the only hook that runs early enough to override DATABASE_URL, and
 * reading a file there doesn't depend on how Jest happens to spawn workers.
 *
 * node_modules is already gitignored, so nothing leaks into the working tree.
 */
export const HANDSHAKE_FILE = join(
  __dirname,
  '..',
  '..',
  'node_modules',
  '.cache',
  'nodebooking-e2e.json',
);
