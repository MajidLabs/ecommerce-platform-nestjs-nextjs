import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/**
 * Every global pipe, filter, interceptor and prefix the app runs with.
 *
 * This lives apart from bootstrap() so the e2e tests can apply the exact
 * same setup to their test app. If it were duplicated in the test file
 * instead, the two copies would drift and the tests would slowly stop
 * reflecting how the server actually behaves — a validation rule added
 * here would appear to be untested, or worse, appear to pass.
 */
export function configureApp(app: INestApplication) {
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['uploads/(.*)'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  return app;
}
