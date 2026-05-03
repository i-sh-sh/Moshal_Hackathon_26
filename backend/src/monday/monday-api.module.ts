import { Module } from '@nestjs/common';
import { MondayApiService } from './monday-api.service';

@Module({
    providers: [MondayApiService],
    exports: [MondayApiService],
})
export class MondayApiModule {}
