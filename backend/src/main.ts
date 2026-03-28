import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ★ CORS 設定：ローカル・Vercel・独自ドメインの全てを許可
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://line-system.vercel.app',
      'https://seibisystem.com',
      'https://www.seibisystem.com',
    ],
    credentials: true,
  });

  // もともとのバリデーション（そのまま）
  app.useGlobalPipes(new ValidationPipe());

  // ★ Render では PORT 環境変数が入るので、両対応にしておく
  const port = process.env.PORT || 4000;
  await app.listen(port);
}

bootstrap();
