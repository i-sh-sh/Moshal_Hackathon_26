/**
 * Mock storage provider — writes to a local directory under `./tmp/uploads`.
 *
 * Useful for local development. Returned URLs use a `mock-storage://` scheme
 * so it's obvious in logs that they aren't real.
 *
 * @version 1.00
 */

import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
    StorageProvider,
    UploadInput,
    UploadResult,
} from './storage.interface';

const ROOT = path.resolve(process.cwd(), 'tmp', 'uploads');

@Injectable()
export class MockStorageProvider implements StorageProvider {
    private readonly logger = new Logger(MockStorageProvider.name);

    async uploadFile(input: UploadInput): Promise<UploadResult> {
        const fullPath = path.join(ROOT, input.key);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, input.body);
        const url = `mock-storage://${input.key}`;
        this.logger.warn(`[MOCK] uploaded ${input.body.length} bytes → ${fullPath}`);
        return { url };
    }

    async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
        return `mock-storage://${key}`;
    }

    async deleteFile(key: string): Promise<void> {
        const fullPath = path.join(ROOT, key);
        await fs.rm(fullPath, { force: true });
        this.logger.warn(`[MOCK] deleted ${fullPath}`);
    }
}
