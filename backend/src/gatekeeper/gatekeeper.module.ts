/**
 * Global gatekeeper module — every module can inject GatekeeperService.
 *
 * @version 1.00
 */

import { Global, Module } from '@nestjs/common';
import { GatekeeperService } from './gatekeeper.service';

@Global()
@Module({
    providers: [GatekeeperService],
    exports: [GatekeeperService],
})
export class GatekeeperModule {}
