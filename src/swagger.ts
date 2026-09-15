import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Shared by `main.ts` (serves it at /api/docs) and `generate-openapi.ts` (writes it to
 * disk), so the committed spec can't drift from the one the running app exposes.
 * Call it after `setGlobalPrefix`, or the paths come out without `/api/v1`.
 */
export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('NodeBookingApi')
      .setDescription('NestJS port of the BookingApi Contact slice')
      .setVersion('0.1.0')
      .build(),
  );
}
