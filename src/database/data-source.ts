import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { Contact } from '../contacts/entities/contact.entity';

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
  entities: [Contact],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
