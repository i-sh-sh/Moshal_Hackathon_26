/**
 * Application bootstrap.
 *
 * Instantiates the Nest app, applies global pipes, configures CORS from
 * the typed config, mounts Swagger at /api/docs, and starts the HTTP server.
 *
 * @version 1.10
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, { bufferLogs: false });
    const config = app.get(ConfigService);

    app.setGlobalPrefix('api');
    app.use(cookieParser());

    app.enableCors({
        origin: [...config.server.corsOrigins],
        credentials: true,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: false },
        }),
    );

    const docBuilder = new DocumentBuilder()
        .setTitle('TeamSprintUp API')
        .setDescription('Backend for the TeamSprintUp hi-tech-workplace simulator.')
        .setVersion(config.version)
        .addBearerAuth()
        .build();
    const doc = SwaggerModule.createDocument(app, docBuilder);
    SwaggerModule.setup('api/docs', app, doc);

    await app.listen(config.server.port);
    Logger.log(
        `Backend v${config.version} on http://localhost:${config.server.port}/api ` +
        `(env=${config.server.nodeEnv}, auth=${config.auth.provider})`,
        'Bootstrap',
    );
    Logger.log(`Swagger docs at http://localhost:${config.server.port}/api/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
    Logger.error(`Bootstrap failed: ${(err as Error).message}`, (err as Error).stack, 'Bootstrap');
    process.exit(1);
});
