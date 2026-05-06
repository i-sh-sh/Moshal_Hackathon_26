/**
 * Anthropic Claude integration module.
 *
 * AIService is exported globally? No — exported on demand. Hints module
 * imports it; nothing else needs Claude directly.
 *
 * @version 1.10
 */

import { Module } from '@nestjs/common';
import { AIService } from './ai.service';

@Module({
    providers: [AIService],
    exports: [AIService],
})
export class AIModule {}
