import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrinterController } from './printer.controller';
import { PrinterService } from './printer.service';

@Module({
    imports: [AuthModule],
    controllers: [PrinterController],
    providers: [PrinterService],
    exports: [PrinterService],
})
export class PrinterModule {}
