import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

// Emits one structured JSON line per request. Deliberately not using
// NestJS's default Logger.log(string) for this — a free-form string like
// "GET /products 200 12ms" is fine to read in a terminal but useless to a
// log aggregator (Datadog, CloudWatch, etc.), which needs consistent
// fields to filter/alert on (e.g. "show me all 5xx for userId=X").
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl, ip } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.emit({
          method,
          path: originalUrl,
          statusCode: context.switchToHttp().getResponse().statusCode,
          durationMs: Date.now() - start,
          userId: req.user?.userId ?? null,
          ip,
        });
      }),
      catchError((err) => {
        this.emit({
          method,
          path: originalUrl,
          statusCode: err.status ?? 500,
          durationMs: Date.now() - start,
          userId: req.user?.userId ?? null,
          ip,
          error: err.message,
        });
        throw err;
      }),
    );
  }

  private emit(entry: Record<string, unknown>) {
    this.logger.log(
      JSON.stringify({ timestamp: new Date().toISOString(), ...entry }),
    );
  }
}
