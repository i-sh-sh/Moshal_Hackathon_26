import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PrintJobStatus {
    PENDING   = 'pending',
    PRINTING  = 'printing',
    DONE      = 'done',
    CANCELLED = 'cancelled',
}

export class UpdateJobStatusDto {
    @IsEnum(PrintJobStatus)
    status!: PrintJobStatus;

    @IsOptional()
    @IsString()
    operatorNotes?: string;
}
