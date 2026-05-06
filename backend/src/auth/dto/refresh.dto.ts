/**
 * Refresh-token DTO. The refresh token is also accepted from a HttpOnly
 * cookie when present — body is the fallback for clients that can't use
 * cookies (mobile apps).
 *
 * @version 1.00
 */

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshDto {
    @IsOptional()
    @IsString()
    @MaxLength(512)
    refreshToken?: string;
}
