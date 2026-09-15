import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';

// The TypeORM CLI runs outside Nest, so it gets no ConfigModule and no direnv
// guarantee — load .env explicitly here.
loadDotenv();

/**
 * Used only by the TypeORM CLI (`npm run migration:*:auth`), against the auth database
 * (separate Postgres database from BookingApi's shared BookingDb). The running app builds
 * its own connection through AuthDatabaseModule.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.AUTH_DATABASE_URL,
  entities: [User],
  migrations: [__dirname + '/migrations/auth/*.{ts,js}'],
  synchronize: false,
});
