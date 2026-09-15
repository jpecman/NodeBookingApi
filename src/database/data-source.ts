import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { Contact } from '../contacts/entities/contact.entity';
import { Field } from '../fields/entities/field.entity';
import { Pitch } from '../pitches/entities/pitch.entity';

// The TypeORM CLI runs outside Nest, so it gets no ConfigModule and no direnv
// guarantee — load .env explicitly here.
loadDotenv();

/**
 * Used only by the TypeORM CLI (`npm run migration:*`). The running app builds its
 * own connection through DatabaseModule.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Contact, Field, Pitch],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
