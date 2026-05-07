/**
 * Auth controller — `/api/auth/*` endpoints.
 *
 * Routes are tagged `@Public()` so the global JWT guard (when enabled)
 * doesn't 401 unauthenticated callers trying to log in.
 *
 * @version 1.00
 */

import {
    Body,
    Controller,
    HttpCode,
    Post,
    Get,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '../config/config.service';
import { LoginInput } from './providers/auth-provider.interface';

const REFRESH_COOKIE = 'tsu_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly config: ConfigService,
    ) {}

    @Public()
    @Post('login')
    @HttpCode(200)
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<Omit<TokenPair, 'refreshToken'>> {
        const input = this.dtoToLoginInput(dto);
        const result = await this.auth.login(input, this.ctx(req));
        this.setRefreshCookie(res, result.refreshToken);
        return this.stripRefresh(result);
    }

    @Public()
    @Post('register')
    @HttpCode(201)
    async register(
        @Body() dto: RegisterDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<Omit<TokenPair, 'refreshToken'>> {
        const result = await this.auth.register(dto, this.ctx(req));
        this.setRefreshCookie(res, result.refreshToken);
        return this.stripRefresh(result);
    }

    @Public()
    @Post('refresh')
    @HttpCode(200)
    async refresh(
        @Body() dto: RefreshDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<Omit<TokenPair, 'refreshToken'>> {
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const raw = dto.refreshToken ?? cookies?.[REFRESH_COOKIE];
        if (!raw) throw new UnauthorizedException('No refresh token provided');
        const result = await this.auth.refreshTokens(raw, this.ctx(req));
        this.setRefreshCookie(res, result.refreshToken);
        return this.stripRefresh(result);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    @HttpCode(204)
    async logout(
        @Body() dto: RefreshDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @CurrentUser() user?: AuthenticatedUser,
    ): Promise<void> {
        const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
        const raw = dto.refreshToken ?? cookies?.[REFRESH_COOKIE];
        if (raw) await this.auth.logout(raw, user);
        res.clearCookie(REFRESH_COOKIE, { path: '/' });
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
        return user;
    }

    private dtoToLoginInput(dto: LoginDto): LoginInput {
        switch (dto.kind) {
            case 'local':
                return { kind: 'local', email: dto.email!, password: dto.password! };
            case 'firebase':
                return { kind: 'firebase', idToken: dto.idToken! };
            case 'google':
                return { kind: 'google', authorizationCode: dto.authorizationCode! };
        }
    }

    private ctx(req: Request): { ip?: string; userAgent?: string } {
        const xff = req.headers['x-forwarded-for'];
        const ip = Array.isArray(xff)
            ? xff[0]
            : (xff?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? undefined);
        return { ip, userAgent: req.headers['user-agent'] };
    }

    private setRefreshCookie(res: Response, raw: string): void {
        res.cookie(REFRESH_COOKIE, raw, {
            httpOnly: true,
            secure: this.config.isProduction,
            sameSite: 'strict',
            path: '/',
            maxAge: this.config.jwt.refreshTtlSeconds * 1000,
        });
    }

    private stripRefresh(t: TokenPair): Omit<TokenPair, 'refreshToken'> {
        const { refreshToken: _ignored, ...rest } = t;
        return rest;
    }
}
