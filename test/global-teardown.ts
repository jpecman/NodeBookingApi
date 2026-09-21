import { rmSync } from 'fs';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { HANDSHAKE_FILE } from './support/handshake';

export default async function globalTeardown(): Promise<void> {
  // Set by globalSetup — see the comment there for why this goes through globalThis.
  const container = (globalThis as Record<string, unknown>).__PG_CONTAINER__ as
    StartedPostgreSqlContainer | undefined;

  if (container) {
    await container.stop({ remove: true });
  }

  rmSync(HANDSHAKE_FILE, { force: true });
}
