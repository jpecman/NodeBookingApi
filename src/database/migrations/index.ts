import type { Constructor } from '@mikro-orm/core';
import type { Migration } from '@mikro-orm/migrations';

/**
 * Migrations for the booking context (BookingApi's shared BookingDb), in run order.
 * Empty on purpose: none of the entities on this connection own their table.
 */
export const BOOKING_MIGRATIONS: Constructor<Migration>[] = [];
