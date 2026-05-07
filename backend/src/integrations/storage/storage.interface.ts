/**
 * Storage integration contract.
 *
 * Used for any persistent file storage — task submissions (images, STL files),
 * profile pictures, exported reports.
 *
 * @version 1.00
 */

export const STORAGE_PROVIDER_TOKEN = Symbol('STORAGE_PROVIDER');

export interface UploadInput {
    /** Path within the bucket, e.g. `submissions/<task-id>/<filename>` */
    readonly key: string;
    readonly contentType: string;
    readonly body: Buffer;
}

export interface UploadResult {
    /** Canonical URL (signed if private). */
    readonly url: string;
}

export interface StorageProvider {
    uploadFile(input: UploadInput): Promise<UploadResult>;
    getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
    deleteFile(key: string): Promise<void>;
}
