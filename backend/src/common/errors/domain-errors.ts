/**
 * Domain-level error classes.
 *
 * These are thrown by services and translated to HTTP exceptions at the
 * controller boundary by NestJS's built-in exception filters. Keep them
 * framework-agnostic so the same services can be reused from a CLI or
 * future GraphQL layer.
 *
 * @version 1.00
 */

import {
    BadRequestException,
    HttpException,
    HttpStatus,
    UnauthorizedException,
} from '@nestjs/common';

export class GatekeeperError extends HttpException {
    constructor(reason: string, public readonly provider?: string) {
        super(`gatekeeper: ${reason}`, HttpStatus.BAD_GATEWAY);
        this.name = 'GatekeeperError';
    }
}

export class GatekeeperQueueFullError extends GatekeeperError {
    constructor(provider: string) {
        super(`queue full for provider "${provider}"`, provider);
        this.name = 'GatekeeperQueueFullError';
    }
}

export class GatekeeperTimeoutError extends GatekeeperError {
    constructor(provider: string) {
        super(`timeout calling provider "${provider}"`, provider);
        this.name = 'GatekeeperTimeoutError';
    }
}

export class InvalidCredentialsError extends UnauthorizedException {
    constructor() {
        super('Invalid credentials');
        this.name = 'InvalidCredentialsError';
    }
}

export class AccountLockedError extends UnauthorizedException {
    constructor(retryAfterSeconds: number) {
        super(`Account temporarily locked. Retry after ${retryAfterSeconds}s.`);
        this.name = 'AccountLockedError';
    }
}

export class AccountDisabledError extends UnauthorizedException {
    constructor() {
        super('Account is disabled');
        this.name = 'AccountDisabledError';
    }
}

export class InvalidRefreshTokenError extends UnauthorizedException {
    constructor() {
        super('Invalid or expired refresh token');
        this.name = 'InvalidRefreshTokenError';
    }
}

export class WeakPasswordError extends BadRequestException {
    constructor() {
        super('Password must be at least 8 characters and contain a letter and a digit');
        this.name = 'WeakPasswordError';
    }
}

export class EmailAlreadyTakenError extends BadRequestException {
    constructor() {
        super('Email is already in use');
        this.name = 'EmailAlreadyTakenError';
    }
}
