import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createSwaggerDocument } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

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

  if (config.get<string>('nodeEnv') !== 'production') {
    SwaggerModule.setup('api/docs', app, createSwaggerDocument(app));
    logger.log('Swagger UI available at /api/docs');
  }

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  logger.log(`NodeBookingApi listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
