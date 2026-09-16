import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slot } from 'src/slots/entities/slot.entity';
import { Booking } from './entities/bookings.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { ContactsService } from 'src/contacts/contacts.service';
import { FieldsService } from 'src/fields/fields.service';
import { ContactsModule } from 'src/contacts/contacts.module';
import { FieldsModule } from 'src/fields/fields.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Slot]), ContactsModule, FieldsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
