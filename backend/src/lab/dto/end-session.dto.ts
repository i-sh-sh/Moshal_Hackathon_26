import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

export enum SessionStatus {
    COMPLETED  = 'completed',
    CANCELLED  = 'cancelled',
}

export class EndSessionDto {
    @IsEnum(SessionStatus)
    status!: SessionStatus;

    @IsOptional()
    @IsUrl()
    outputUrl?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
