import type { Constructor } from '@mikro-orm/core';
import type { Migration } from '@mikro-orm/migrations';
import { InitSchema1789992294000 } from './1789992294000-InitSchema';

/**
 * Every migration, in run order. An explicit list rather than folder discovery: the
 * migrator is an ES module and can't import `.ts` through ts-node.
 */
export const MIGRATIONS: Constructor<Migration>[] = [InitSchema1789992294000];
