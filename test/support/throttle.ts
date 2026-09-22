import type { INestApplication } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';

/** The in-memory ThrottlerStorageService, past the `ThrottlerStorage` interface. */
type InMemoryThrottlerStorage = ThrottlerStorage & {
  storage?: Map<string, unknown>;
  timeoutIds?: Map<string, NodeJS.Timeout[]>;
};

/**
 * Forgets every recorded login attempt, so a spec that logs in more than the limit allows
 * doesn't start 429-ing partway through. See test/README.md.
 *
 * Both maps have to go: a pending timeout from a cleared record would decrement the count
 * of the next record created under the same key.
 */
export function resetRateLimit(app: INestApplication): void {
  const storage = app.get<InMemoryThrottlerStorage>(ThrottlerStorage, { strict: false });

  storage.timeoutIds?.forEach((timeouts) => timeouts.forEach(clearTimeout));
  storage.timeoutIds?.clear();
  storage.storage?.clear();
}
