import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QuizAnswerDto {
    @ApiProperty()
    @IsUUID()
    questionId!: string;

    @ApiProperty()
    @IsInt()
    @Min(0)
    selectedIndex!: number;
}

export class SubmitQuizDto {
    @ApiProperty({ type: [QuizAnswerDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => QuizAnswerDto)
    answers!: QuizAnswerDto[];
}
