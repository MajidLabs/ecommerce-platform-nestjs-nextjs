// Must be the first import in the app — see src/instrument.ts.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Shared with the e2e tests — see src/app.config.ts.
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setDescription('REST API for the e-commerce platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
