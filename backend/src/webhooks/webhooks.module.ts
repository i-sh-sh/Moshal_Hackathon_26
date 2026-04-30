import { Module } from '@nestjs/common';
import { MondayController } from './monday.controller';

@Module({
    controllers: [MondayController],
})
export class WebhooksModule { }