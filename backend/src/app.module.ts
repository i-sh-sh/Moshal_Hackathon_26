import { Module } from '@nestjs/common';
import { AIModule } from './ai/ai.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
    imports: [AIModule, WebhooksModule],
})
export class AppModule { }