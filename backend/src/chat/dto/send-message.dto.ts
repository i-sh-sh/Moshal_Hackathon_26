import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
    @IsUUID()
    senderId!: string;

    @IsString()
    @IsNotEmpty()
    senderName!: string;

    @IsString()
    @IsNotEmpty()
    content!: string;
}
