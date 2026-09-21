import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { createSwaggerDocument } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  configureApp(app);

  if (config.get<string>('nodeEnv') !== 'production') {
    SwaggerModule.setup('api/docs', app, createSwaggerDocument(app));
    logger.log('Swagger UI available at /api/docs');
  }

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  logger.log(`NodeBookingApi listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
