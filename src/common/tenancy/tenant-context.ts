import { AsyncLocalStorage } from 'async_hooks';

export interface TenantStore {
  userId: string;
  tenantId: string;
}

/**
 * Opened per request by TenantContextInterceptor, which wraps the downstream handler in
 * run() using the user JwtStrategy.validate() returned. It covers the controller, the
 * services and the MikroORM calls beneath them — including TENANT_FILTER and the
 * tenantId onCreate hook (tenant.filter.ts), which read it at query/flush time.
 */
export const tenantContext = new AsyncLocalStorage<TenantStore>();

export function getCurrentTenantId(): string {
  const store = tenantContext.getStore();

  if (!store) {
    throw new Error('getCurrentTenantId() called outside an authenticated request context');
  }

  return store.tenantId;
}
