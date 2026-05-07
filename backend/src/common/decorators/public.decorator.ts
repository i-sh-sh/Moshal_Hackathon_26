/**
 * `@Public()` route decorator.
 *
 * Marks a route as exempt from the JwtAuthGuard. Used during the additive-
 * auth migration phase so existing endpoints stay reachable while the
 * frontend integrates login (see docs/AUTH.md).
 *
 * @version 1.00
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (): MethodDecorator & ClassDecorator =>
    SetMetadata(IS_PUBLIC_KEY, true);
