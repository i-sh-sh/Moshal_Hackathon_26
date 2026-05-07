/**
 * JwtAuthGuard — verifies a Bearer access token and attaches the decoded
 * AuthenticatedUser to `req.user`.
 *
 * Routes marked with `@Public()` bypass the guard entirely. This is used
 * during the additive-auth phase to keep existing routes reachable while
 * the frontend integrates login.
 *
 * @version 1.00
 */

import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtService } from '../jwt.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwt: JwtService,
    ) {}

    canActivate(ctx: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (isPublic) return true;

        const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or malformed Authorization header');
        }
        const token = header.slice('Bearer '.length).trim();
        const payload = this.jwt.verifyAccessToken(token);
        req.user = {
            userId: payload.userId,
            email: payload.email,
            accountType: payload.accountType,
            currentRole: payload.currentRole,
            currentTeamId: payload.currentTeamId,
        };
        return true;
    }
}
