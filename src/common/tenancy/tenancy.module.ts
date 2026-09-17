import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextInterceptor } from './tenant-context.interceptor';

/**
 * Only the request-side half lives here. The ORM-side half is declarative on the
 * entities: `@Filter(TENANT_FILTER)` and `onCreate: currentTenantOnCreate` (tenant.filter.ts).
 */
@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor }],
})
export class TenancyModule {}
