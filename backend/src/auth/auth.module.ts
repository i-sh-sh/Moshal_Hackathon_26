/**
 * Auth module — wires the active provider, JWT services, refresh-token
 * persistence, and the HTTP controller.
 *
 * @version 1.00
 */

import { Module } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditModule } from '../audit/audit.module';
import { FirebaseIntegrationModule } from '../integrations/firebase/firebase.module';
import { FIREBASE_PROVIDER_TOKEN, FirebaseProvider } from '../integrations/firebase/firebase.interface';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { FirebaseAuthProvider } from './providers/firebase-auth.provider';
import { GoogleOAuthProvider } from './providers/google-oauth.provider';
import { AUTH_PROVIDER_TOKEN, AuthProvider } from './providers/auth-provider.interface';

@Module({
    imports: [AuditModule, FirebaseIntegrationModule],
    providers: [
        JwtService,
        RefreshTokenService,
        LocalAuthProvider,
        FirebaseAuthProvider,
        GoogleOAuthProvider,
        AuthService,
        JwtAuthGuard,
        RolesGuard,
        {
            provide: AUTH_PROVIDER_TOKEN,
            inject: [ConfigService, LocalAuthProvider, SupabaseService, AuditLogService, FIREBASE_PROVIDER_TOKEN],
            useFactory: (
                cfg: ConfigService,
                local: LocalAuthProvider,
                _supabase: SupabaseService,
                _audit: AuditLogService,
                firebaseAdapter: FirebaseProvider,
            ): AuthProvider => {
                switch (cfg.auth.provider) {
                    case 'firebase':
                        return new FirebaseAuthProvider(_supabase, firebaseAdapter);
                    case 'google':
                        return new GoogleOAuthProvider();
                    case 'local':
                    default:
                        return local;
                }
            },
        },
    ],
    controllers: [AuthController],
    exports: [JwtService, JwtAuthGuard, RolesGuard, LocalAuthProvider, RefreshTokenService, AuthService],
})
export class AuthModule {}
