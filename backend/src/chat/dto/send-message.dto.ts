import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
    @IsString()
    senderId!: string;

    @IsString()
    @IsNotEmpty()
    senderName!: string;

    @IsString()
    @IsNotEmpty()
    content!: string;
}
