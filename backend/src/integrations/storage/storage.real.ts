/**
 * Real storage provider — stub for AWS S3.
 *
 * TODO(creds-day): wire `@aws-sdk/client-s3` once we have an AWS account.
 *   1. `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
 *   2. Set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
 *      `STORAGE_BUCKET` env vars.
 *   3. Replace the stubs below with `S3Client` calls wrapped in
 *      `gatekeeper.execute('storage', () => ...)`.
 *   4. Set `STORAGE_PROVIDER=real`.
 *
 * @version 0.10
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    StorageProvider,
    UploadInput,
    UploadResult,
} from './storage.interface';
import { GatekeeperService } from '../../gatekeeper/gatekeeper.service';

@Injectable()
export class RealStorageProvider implements StorageProvider {
    private readonly logger = new Logger(RealStorageProvider.name);

    constructor(private readonly _gatekeeper: GatekeeperService) {
        this.logger.warn(
            'RealStorageProvider not implemented — install @aws-sdk/client-s3 and ' +
            'replace this stub before flipping STORAGE_PROVIDER=real',
        );
    }

    async uploadFile(_input: UploadInput): Promise<UploadResult> {
        throw new Error('RealStorageProvider.uploadFile not implemented. See TODO(creds-day).');
    }

    async getSignedUrl(_key: string, _expiresInSeconds: number): Promise<string> {
        throw new Error('RealStorageProvider.getSignedUrl not implemented. See TODO(creds-day).');
    }

    async deleteFile(_key: string): Promise<void> {
        throw new Error('RealStorageProvider.deleteFile not implemented. See TODO(creds-day).');
    }
}
