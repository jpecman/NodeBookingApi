import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantSubscriber } from './tenant.subscriber';

@Module({
  providers: [TenantSubscriber, { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor }],
})
export class TenancyModule {}
