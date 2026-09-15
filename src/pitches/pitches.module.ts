import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Pitch } from './entities/pitch.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Pitch])]
})
export class PitchesModule {}