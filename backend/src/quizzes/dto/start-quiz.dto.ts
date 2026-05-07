import { IsIn, IsOptional, IsInt, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_QUIZ_LENGTH, MIN_QUIZ_LENGTH, QuizPhase } from '../quizzes.types';

export class StartQuizDto {
    @ApiProperty()
    @IsUUID()
    userId!: string;

    @ApiProperty({ enum: ['pre', 'post'] })
    @IsIn(['pre', 'post'])
    phase!: QuizPhase;

    @ApiProperty({ required: false, minimum: MIN_QUIZ_LENGTH, maximum: MAX_QUIZ_LENGTH })
    @IsOptional()
    @IsInt()
    @Min(MIN_QUIZ_LENGTH)
    @Max(MAX_QUIZ_LENGTH)
    length?: number;
}
