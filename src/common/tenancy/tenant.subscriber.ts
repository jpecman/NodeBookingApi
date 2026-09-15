import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';
import { getCurrentTenantId } from './tenant-context';

/**
 * Stamps tenant_id on insert for any entity that has the column and doesn't already set
 * it — the insert-time half of what BookingApi's EF Core global query filter did on
 * SaveChanges. Query-time filtering (`where: { tenantId }`) stays explicit in each
 * service, since TypeORM has no automatic global-filter equivalent to EF's HasQueryFilter.
 *
 * Registered on the default connection (BookingApi's shared BookingDb), since that's
 * where tenant-owned entities like Contact live.
 */
@Injectable()
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<object>): void {
    const entity = event.entity as { tenantId?: string } | undefined;

    if (entity && 'tenantId' in entity && !entity.tenantId) {
      entity.tenantId = getCurrentTenantId();
    }
  }
}
