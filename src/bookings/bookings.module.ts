import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ContactsModule } from '../contacts/contacts.module';
import { BOOKING_CONTEXT } from '../database/mikro-orm.options';
import { FieldsModule } from '../fields/fields.module';
import { Slot } from '../slots/entities/slot.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/bookings.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([Booking, Slot], BOOKING_CONTEXT),
    ContactsModule,
    FieldsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
