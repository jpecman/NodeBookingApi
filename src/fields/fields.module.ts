import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BOOKING_CONTEXT } from '../database/mikro-orm.options';
import { Field } from './entities/field.entity';
import { FieldsController } from './fields.controller';
import { FieldsService } from './fields.service';

@Module({
  imports: [MikroOrmModule.forFeature([Field], BOOKING_CONTEXT)],
  controllers: [FieldsController],
  providers: [FieldsService],
  exports: [FieldsService],
})
export class FieldsModule {}
