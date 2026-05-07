/**
 * Heartbeat DTO. The frontend pings ~once per minute while the user is
 * active. `deltaSeconds` is capped server-side to bound abuse — even if
 * a malicious client sends 999, we accept at most {@link MAX_DELTA_SECONDS}.
 *
 * @version 1.00
 */

import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const MAX_DELTA_SECONDS = 120;

export class HeartbeatDto {
    @IsInt()
    @Min(1)
    @Max(MAX_DELTA_SECONDS)
    deltaSeconds!: number;

    /**
     * Used during the additive-auth phase — the JWT is preferred when
     * present, but if no Authorization header is sent, the userId in the
     * body is the fallback.
     */
    @IsOptional()
    @IsUUID()
    userId?: string;
}
