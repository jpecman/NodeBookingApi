import type { FilterDef } from '@mikro-orm/core';
import { getCurrentTenantId } from './tenant-context';

/**
 * MikroORM's counterpart to BookingApi's EF Core HasQueryFilter: adds
 * `"TenantId" = <current tenant>` to every find/count/nativeUpdate/nativeDelete on an
 * entity that carries `@Filter(TENANT_FILTER)`, including when it's populated as a
 * relation. QueryBuilder queries don't apply filters on their own, so they still filter
 * explicitly.
 *
 * The condition is a callback so it's resolved per query from the request's tenant
 * context — calling it outside an authenticated request throws, same as
 * getCurrentTenantId().
 */
export const TENANT_FILTER: FilterDef = {
  name: 'tenant',
  cond: () => ({ tenantId: getCurrentTenantId() }),
  default: true,
};

/**
 * `onCreate` hook for tenant-owned entities' tenantId — the insert-time half of the
 * tenancy story, replacing TypeORM's TenantSubscriber.beforeInsert(). Only runs when
 * tenantId wasn't set explicitly.
 */
export const currentTenantOnCreate = (): string => getCurrentTenantId();
