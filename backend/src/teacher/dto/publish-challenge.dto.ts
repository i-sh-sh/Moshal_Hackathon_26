import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PublishChallengeDto {
    @ApiProperty({ description: 'Team that receives the challenge' })
    @IsUUID()
    teamId!: string;
}
