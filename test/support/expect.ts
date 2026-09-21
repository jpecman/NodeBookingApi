import type { Response } from 'supertest';

/**
 * AllExceptionsFilter emits exactly three shapes. Encoding them once keeps every
 * assertion in the suite honest about which one it expects.
 *
 * This is the string-payload shape: an HttpException thrown with a message, or the
 * catch-all 500. No `errors` key.
 */
export function expectError(res: Response, statusCode: number, message?: string | RegExp): void {
  expect(res.status).toBe(statusCode);
  expect(res.body).toEqual({
    statusCode,
    message:
      message instanceof RegExp ? expect.stringMatching(message) : (message ?? expect.any(String)),
    timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    path: expect.any(String),
  });
}

/**
 * ValidationPipe's array payload: the filter moves the per-field messages into `errors`
 * and puts Nest's own `error` string ("Bad Request") in `message`.
 */
export function expectValidationError(res: Response, ...contains: string[]): void {
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ statusCode: 400, message: 'Bad Request' });
  expect(res.body.errors).toEqual(expect.arrayContaining(contains));
  expect(res.body).toHaveProperty('timestamp');
  expect(res.body).toHaveProperty('path');
}
