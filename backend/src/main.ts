import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ★ CORS 設定：ローカルと Vercel 本番の両方を許可
  app.enableCors({
    origin: [
      'http://localhost:3000',         // ローカル開発用フロント
      'https://line-system.vercel.app' // Vercel 本番フロント
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
