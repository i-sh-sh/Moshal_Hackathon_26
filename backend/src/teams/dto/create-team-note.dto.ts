import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTeamNoteDto {
    @IsString()
    @IsNotEmpty()
    note!: string;

    @IsString()
    @IsOptional()
    teacherId?: string;
}
