/**
 * RolesGuard — checks that req.user has one of the required AccountTypes
 * declared by `@Roles(...)` on the route.
 *
 * Must be applied AFTER JwtAuthGuard — it relies on `req.user` being set.
 *
 * @version 1.00
 */

import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AccountType, AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(ctx: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<AccountType[]>(ROLES_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        if (!required || required.length === 0) return true;

        const req = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
        const user = req.user;
        if (!user) throw new ForbiddenException('Unauthenticated');
        if (!required.includes(user.accountType)) {
            throw new ForbiddenException(
                `Account type "${user.accountType}" cannot perform this action`,
            );
        }
        return true;
    }
}
