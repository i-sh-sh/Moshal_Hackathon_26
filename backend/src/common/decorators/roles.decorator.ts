/**
 * `@Roles(...)` route decorator.
 *
 * Declares which AccountTypes are allowed to call a route. Enforced by
 * RolesGuard — has no effect unless that guard is also applied.
 *
 * @version 1.00
 */

import { SetMetadata } from '@nestjs/common';
import { AccountType } from '../types/authenticated-user';

export const ROLES_KEY = 'requiredRoles';

export const Roles = (...roles: AccountType[]): MethodDecorator & ClassDecorator =>
    SetMetadata(ROLES_KEY, roles);
