import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateStudentNoteDto {
    @IsString()
    @IsNotEmpty()
    note!: string;

    @IsString()
    @IsOptional()
    teacherId?: string;
}
