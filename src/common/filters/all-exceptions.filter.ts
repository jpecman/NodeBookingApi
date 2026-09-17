import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { UniqueConstraintViolationException } from '@mikro-orm/core';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Friendly messages for constraints we know about, so a 409 says something useful
 * without leaking the raw driver detail (which echoes the offending values).
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  IX_Contacts_TenantId_Email: 'A contact with this email address already exists.',
};

/**
 * MikroORM translates SQLSTATE 23505 into UniqueConstraintViolationException and copies
 * the pg error's own fields onto it, `constraint` among them.
 */
type UniqueViolation = UniqueConstraintViolationException & { constraint?: string };

/**
 * The single place where anything thrown becomes an HTTP response.
 *
 * This replaces BookingApi's two-part scheme (the `Gateway` base class catching
 * driver errors into `Either<Error, T>`, plus `BaseApiController.HandleError`
 * mapping them to status codes). Services just throw; this decides the wire format.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, errors } = this.describe(exception, request);

    const body: ErrorResponseDto = {
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }

  private describe(
    exception: unknown,
    request: Request,
  ): { status: number; message: string; errors?: string[] } {
    if (exception instanceof HttpException) {
      return { ...this.fromHttpException(exception) };
    }

    if (exception instanceof UniqueConstraintViolationException) {
      const constraint = (exception as UniqueViolation).constraint ?? '';
      this.logger.warn(
        `Unique violation on ${constraint || 'unknown constraint'} for ${request.method} ${request.url}`,
      );
      return {
        status: HttpStatus.CONFLICT,
        message: CONSTRAINT_MESSAGES[constraint] ?? 'A record with these values already exists.',
      };
    }

    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private fromHttpException(exception: HttpException): {
    status: number;
    message: string;
    errors?: string[];
  } {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { status, message: payload };
    }

    // ValidationPipe puts its per-field failures in `message` as an array.
    const { message, error } = payload as { message?: string | string[]; error?: string };

    if (Array.isArray(message)) {
      return { status, message: error ?? 'Validation failed', errors: message };
    }

    return { status, message: message ?? exception.message };
  }
}
