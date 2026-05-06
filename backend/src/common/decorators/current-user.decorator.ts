/**
 * `@CurrentUser()` parameter decorator.
 *
 * Extracts the AuthenticatedUser previously attached by the JwtAuthGuard.
 * Returns `undefined` on routes marked `@Public()` — callers must handle that
 * case explicitly.
 *
 * @version 1.00
 */

import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
        const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
        return req.user;
    },
);
