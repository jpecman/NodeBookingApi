import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Pitch } from './entities/pitch.entity';

@Module({
  imports: [MikroOrmModule.forFeature([Pitch])],
})
export class PitchesModule {}
