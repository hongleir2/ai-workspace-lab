export interface UploadTarget {
  uploadUrl: string;
  objectKey: string;
  bucket: string;
  expiresAt: Date;
}

export interface ObjectMetadata {
  contentType: string;
  byteSize: number;
  checksumSha256?: string;
}

export interface CreateUploadTargetParams {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface UploadObjectParams {
  objectKey: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export interface StorageProvider {
  createUploadTarget(params: CreateUploadTargetParams): Promise<UploadTarget>;
  uploadObject(params: UploadObjectParams): Promise<void>;
  getObjectMetadata(objectKey: string): Promise<ObjectMetadata>;
  deleteObject(objectKey: string): Promise<void>;
  downloadObject(objectKey: string): Promise<Buffer>;
}
