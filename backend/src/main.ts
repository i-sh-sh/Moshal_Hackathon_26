import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    const allowedOrigins = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
        : ['http://localhost:3000'];

    app.enableCors({ origin: allowedOrigins, credentials: true });
    app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );

    const port = process.env.PORT ?? 3001;
    await app.listen(port);
    Logger.log(`Backend running on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
