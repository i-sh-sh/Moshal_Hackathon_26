import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum EventType {
    EVENT        = 'event',
    DEADLINE     = 'deadline',
    ANNOUNCEMENT = 'announcement',
}

export class CreateEventDto {
    @IsString()
    title!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsDateString()
    eventDate!: string;

    @IsEnum(EventType)
    @IsOptional()
    eventType?: EventType = EventType.EVENT;

    @IsOptional()
    @IsUUID()
    teamId?: string;
}
