import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    app.enableCors(); // tighten before prod
    const port = process.env.PORT ?? 3001;
    await app.listen(port);
    Logger.log(`Backend running on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();