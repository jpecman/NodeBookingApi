export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  database: {
    url: string;
  };
}

/**
 * Shapes the flat environment into a nested, typed config tree so consumers read
 * `config.get('database.url')` instead of reaching for `process.env` directly.
 */
export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    url: process.env.DATABASE_URL as string,
  },
});
