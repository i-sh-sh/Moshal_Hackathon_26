/**
 * Root composition for the TeamSprintUp backend.
 *
 * @version 1.20
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { SupabaseModule } from './supabase/supabase.module';
import { GatekeeperModule } from './gatekeeper/gatekeeper.module';
import { AuditModule } from './audit/audit.module';
import { AIModule } from './integrations/ai/ai.module';
import { MondayApiModule } from './integrations/monday/monday-api.module';
import { FirebaseIntegrationModule } from './integrations/firebase/firebase.module';
import { StorageIntegrationModule } from './integrations/storage/storage.module';
import { TechSchoolIntegrationModule } from './integrations/techschool/techschool.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ActivityModule } from './activity/activity.module';
import { TasksModule } from './tasks/tasks.module';
import { HintsModule } from './hints/hints.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MockMondayModule } from './mock-monday/mock-monday.module';
import { ChatModule } from './chat/chat.module';
import { DudeModule } from './dude/dude.module';
import { StudentProfileModule } from './student-profile/student-profile.module';

@Module({
    imports: [
        ConfigModule,
        SupabaseModule,
        GatekeeperModule,
        AuditModule,
        AIModule,
        MondayApiModule,
        FirebaseIntegrationModule,
        StorageIntegrationModule,
        TechSchoolIntegrationModule,
        AuthModule,
        AdminModule,
        ActivityModule,
        TeamsModule,
        UsersModule,
        TasksModule,
        HintsModule,
        WebhooksModule,
        MockMondayModule,
        ChatModule,
        StudentProfileModule,
        DudeModule,
    ],
})
export class AppModule {}
