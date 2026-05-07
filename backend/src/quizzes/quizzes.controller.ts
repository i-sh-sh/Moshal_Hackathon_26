/**
 * Quiz REST endpoints — pre/post mission knowledge measurement.
 *
 * @version 1.00
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuizzesService } from './quizzes.service';
import { StartQuizDto } from './dto/start-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { QuizPhase } from './quizzes.types';

@ApiTags('quizzes')
@Controller('quizzes')
export class QuizzesController {
    constructor(private readonly quizzes: QuizzesService) {}

    @Post('missions/:challengeId/start')
    start(
        @Param('challengeId') challengeId: string,
        @Body() dto: StartQuizDto,
    ) {
        return this.quizzes.startQuiz(challengeId, dto);
    }

    @Post('attempts/:attemptId/submit')
    submit(
        @Param('attemptId') attemptId: string,
        @Body() dto: SubmitQuizDto,
    ) {
        return this.quizzes.submitQuiz(attemptId, dto);
    }

    @Get('missions/:challengeId/me')
    getMine(
        @Param('challengeId') challengeId: string,
        @Query('userId') userId: string,
        @Query('phase') phase: QuizPhase,
    ) {
        return this.quizzes.getMyAttempt(challengeId, userId, phase);
    }

    @Get('missions/:challengeId/results')
    results(@Param('challengeId') challengeId: string) {
        return this.quizzes.getResultsForChallenge(challengeId);
    }
}
