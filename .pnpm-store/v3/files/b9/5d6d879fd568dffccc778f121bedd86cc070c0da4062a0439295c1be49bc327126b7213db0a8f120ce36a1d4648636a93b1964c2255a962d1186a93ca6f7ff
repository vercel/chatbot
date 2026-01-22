import { Readable } from 'stream';

interface BlobCommandOptions {
    /**
     * Define your blob API token.
     * @defaultvalue process.env.BLOB_READ_WRITE_TOKEN
     */
    token?: string;
    /**
     * `AbortSignal` to cancel the running request. See https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
     */
    abortSignal?: AbortSignal;
}
interface CommonCreateBlobOptions extends BlobCommandOptions {
    /**
     * Whether the blob should be publicly accessible.
     */
    access: 'public';
    /**
     * Adds a random suffix to the filename.
     * @defaultvalue true
     */
    addRandomSuffix?: boolean;
    /**
     * Defines the content type of the blob. By default, this value is inferred from the pathname. Sent as the 'content-type' header when downloading a blob.
     */
    contentType?: string;
    /**
     * Number in seconds to configure the edge and browser cache. The maximum values are 5 minutes for the edge cache and unlimited for the browser cache.
     * Detailed documentation can be found here: https://vercel.com/docs/storage/vercel-blob#caching
     * @defaultvalue 365 * 24 * 60 * 60 (1 Year)
     */
    cacheControlMaxAge?: number;
}
declare class BlobError extends Error {
    constructor(message: string);
}
declare function getDownloadUrl(blobUrl: string): string;

interface PutBlobResult {
    url: string;
    downloadUrl: string;
    pathname: string;
    contentType?: string;
    contentDisposition: string;
}
type PutBody = string | Readable | Buffer | Blob | ArrayBuffer | ReadableStream | File;

interface PartInput {
    partNumber: number;
    blob: PutBody;
}
interface Part {
    partNumber: number;
    etag: string;
}

interface CommonCompleteMultipartUploadOptions {
    uploadId: string;
    key: string;
}
type CompleteMultipartUploadCommandOptions = CommonCompleteMultipartUploadOptions & CommonCreateBlobOptions;

interface CommonMultipartUploadOptions {
    uploadId: string;
    key: string;
    partNumber: number;
}
type UploadPartCommandOptions = CommonMultipartUploadOptions & CommonCreateBlobOptions;

interface CreateFolderResult {
    pathname: string;
    url: string;
}
/**
 * Creates a folder in your store. Vercel Blob has no real concept of folders, our file browser on Vercel.com displays folders based on the presence of trailing slashes in the pathname. Unless you are building a file browser system, you probably don't need to use this method.
 *
 * Use the resulting `url` to delete the folder, just like you would delete a blob.
 * @param pathname - Can be user1/ or user1/avatars/
 * @param options - Additional options like `token`
 */
declare function createFolder(pathname: string, options?: BlobCommandOptions): Promise<CreateFolderResult>;

export { type BlobCommandOptions as B, type CommonMultipartUploadOptions as C, type PutBody as P, type UploadPartCommandOptions as U, type PutBlobResult as a, type Part as b, type CommonCompleteMultipartUploadOptions as c, createFolder as d, type CommonCreateBlobOptions as e, BlobError as f, type CompleteMultipartUploadCommandOptions as g, getDownloadUrl as h, type PartInput as i };
