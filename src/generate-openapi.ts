import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createSwaggerDocument } from './swagger';

/**
 * Writes the OpenAPI spec to disk without starting an HTTP server. Run via
 * `npm run openapi:generate [outfile]` (defaults to ./openapi.json).
 *
 * The app is still constructed, so both MikroORM contexts connect during
 * module init — `DATABASE_URL` has to be reachable even
 * though nothing is queried.
 */
async function generate(): Promise<void> {
  const outPath = resolve(process.cwd(), process.argv[2] ?? 'openapi.json');

  const app = await NestFactory.create(AppModule, { logger: false });

  try {
    // Must match main.ts, or every path in the spec loses its /api/v1 prefix.
    app.setGlobalPrefix('api/v1');

    const document = createSwaggerDocument(app);
    writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

    const pathCount = Object.keys(document.paths).length;
    console.log(`Wrote ${pathCount} paths to ${outPath}`);
  } finally {
    await app.close();
  }
}

generate().catch((error: unknown) => {
  console.error('Failed to generate the OpenAPI document:', error);
  process.exitCode = 1;
});
