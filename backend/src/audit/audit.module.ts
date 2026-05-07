/**
 * Audit log module — global so any feature can inject AuditLogService.
 *
 * @version 1.00
 */

import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Global()
@Module({
    providers: [AuditLogService],
    exports: [AuditLogService],
})
export class AuditModule {}
