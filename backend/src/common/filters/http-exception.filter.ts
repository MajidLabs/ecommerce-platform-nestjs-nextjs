import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SentryExceptionCaptured } from '@sentry/nestjs';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  // Reports whatever reaches this catch-all to Sentry. Sentry's own
  // NestJS integration already excludes plain HttpExceptions (400/401/
  // 404/etc.) here, since those are normal control flow, not bugs — only
  // genuinely unexpected errors (a null pointer, a failed DB call, a 500)
  // turn into a Sentry issue. With SENTRY_DSN unset this is a no-op.
  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? (exceptionResponse as any).message
        : exceptionResponse || 'Internal server error';

    // A 4xx is the API working correctly — a wrong password, a missing
    // record, a request the caller isn't allowed to make. Logging those
    // at error level with a full stack trace buries the 5xx responses
    // that actually need attention, and would make the Sentry/alerting
    // signal useless. So: 5xx keeps the stack trace at error level,
    // 4xx gets a one-line warning instead.
    const logLine = `${request.method} ${request.url} ${status}`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logLine, (exception as Error)?.stack);
    } else {
      this.logger.warn(logLine);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
