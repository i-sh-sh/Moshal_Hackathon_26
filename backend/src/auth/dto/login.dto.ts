/**
 * Login DTOs — discriminated union over auth providers.
 *
 * @version 1.00
 */

import {
    IsEmail,
    IsIn,
    IsString,
    MaxLength,
    MinLength,
    ValidateIf,
} from 'class-validator';

export class LoginDto {
    @IsIn(['local', 'firebase', 'google'])
    kind!: 'local' | 'firebase' | 'google';

    @ValidateIf((o: LoginDto) => o.kind === 'local')
    @IsEmail()
    @MaxLength(254)
    email?: string;

    @ValidateIf((o: LoginDto) => o.kind === 'local')
    @IsString()
    @MinLength(8)
    @MaxLength(256)
    password?: string;

    @ValidateIf((o: LoginDto) => o.kind === 'firebase')
    @IsString()
    @MaxLength(4096)
    idToken?: string;

    @ValidateIf((o: LoginDto) => o.kind === 'google')
    @IsString()
    @MaxLength(2048)
    authorizationCode?: string;
}
