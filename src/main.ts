import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import cookieParser from 'cookie-parser'; 

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://co-stream-web-nine.vercel.app',   
      process.env.FRONTEND_URL,                 
    ].filter(Boolean),
    credentials: true,
  });

  app.use(helmet());
  app.use(cookieParser()); 

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'webhooks/livekit', method: RequestMethod.POST }],
  });

  await app.listen(3000);
}
bootstrap();