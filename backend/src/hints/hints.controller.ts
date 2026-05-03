import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { HintsService } from './hints.service';
import { RequestHintDto } from './dto/request-hint.dto';

@Controller('hints')
export class HintsController {
    constructor(private readonly hints: HintsService) {}

    @Post()
    @HttpCode(200)
    requestHint(@Body() dto: RequestHintDto) {
        return this.hints.requestHint(dto);
    }

    @Get('count')
    getCount(
        @Query('userId') userId: string,
        @Query('teamId') teamId: string,
    ) {
        return this.hints.getHintCount(userId, teamId).then((count) => ({ count }));
    }

    @Get('history')
    getHistory(
        @Query('userId') userId: string,
        @Query('teamId') teamId: string,
    ) {
        return this.hints.getHintHistory(userId, teamId);
    }
}
