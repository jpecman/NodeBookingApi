import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Everything the app needs that isn't a module: the cookie parser, the route prefix, the
 * validation pipe and the exception filter.
 *
 * It lives here rather than inline in main.ts so the e2e harness can apply the exact same
 * wiring — a copy in the tests would drift silently, and the tests would keep passing
 * against the stale configuration.
 */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown keys, then reject the request if any were present, so typos
      // in a client payload surface as 400s instead of being silently ignored.
      whitelist: true,
      forbidNonWhitelisted: true,
      // Turn plain JSON into real DTO instances so @Type/@IsInt coercion applies.
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
}
