import type { Constructor } from '@mikro-orm/core';
import type { Migration } from '@mikro-orm/migrations';
import { InitUsers1786526086634 } from './1786526086634-InitUsers';

/** Migrations for the auth context (nodebookingauth database), in run order. */
export const AUTH_MIGRATIONS: Constructor<Migration>[] = [InitUsers1786526086634];
