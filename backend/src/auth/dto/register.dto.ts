/**
 * Self-registration DTO — only the local provider supports this, and only
 * when ALLOW_SELF_REGISTRATION=true. Production schools provision users
 * via the admin API.
 *
 * @version 1.00
 */

import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @MinLength(2)
    @MaxLength(80)
    name!: string;

    @IsEmail()
    @MaxLength(254)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(256)
    password!: string;
}
