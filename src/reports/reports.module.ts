import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BOOKING_CONTEXT } from '../database/mikro-orm.options';
import { Slot } from '../slots/entities/slot.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Read-only aggregates over the booking data. Only Slot is registered here — the query
 * starts from slots and reaches Booking/Contact through populate, and both are already
 * discovered via their own modules' forFeature.
 */
@Module({
  imports: [MikroOrmModule.forFeature([Slot], BOOKING_CONTEXT)],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
