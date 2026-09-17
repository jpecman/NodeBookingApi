import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BOOKING_CONTEXT } from '../database/mikro-orm.options';
import { Pitch } from './entities/pitch.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Pitch], BOOKING_CONTEXT)],
})
export class PitchesModule {}
