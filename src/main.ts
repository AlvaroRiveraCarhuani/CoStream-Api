import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors();

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'webhooks/livekit', method: RequestMethod.POST }],
  });

  await app.listen(3000);
}
bootstrap();