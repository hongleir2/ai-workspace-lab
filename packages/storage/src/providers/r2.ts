import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageError } from '../errors';
import type {
  CreateUploadTargetParams,
  ObjectMetadata,
  StorageProvider,
  UploadObjectParams,
  UploadTarget,
} from '../types';

function getR2Client(): S3Client {
  const accountId = process.env['R2_ACCOUNT_ID'];
  const accessKeyId = process.env['R2_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'];

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new StorageError(
      'PROVIDER_ERROR',
      'R2 credentials not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)',
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getR2Bucket(): string {
  const bucket = process.env['R2_BUCKET'];
  if (!bucket) throw new StorageError('PROVIDER_ERROR', 'R2_BUCKET is not configured');
  return bucket;
}

export class R2StorageProvider implements StorageProvider {
  async createUploadTarget(params: CreateUploadTargetParams): Promise<UploadTarget> {
    const client = getR2Client();
    const bucket = getR2Bucket();
    const expiresInSeconds = params.expiresInSeconds ?? 900;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: params.objectKey,
      ContentType: params.contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    return {
      uploadUrl,
      objectKey: params.objectKey,
      bucket,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async uploadObject(params: UploadObjectParams): Promise<void> {
    const client = getR2Client();
    const bucket = getR2Bucket();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.objectKey,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
  }

  async getObjectMetadata(objectKey: string): Promise<ObjectMetadata> {
    const client = getR2Client();
    const bucket = getR2Bucket();

    try {
      const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      const metadata: ObjectMetadata = {
        contentType: res.ContentType ?? 'application/octet-stream',
        byteSize: res.ContentLength ?? 0,
      };
      if (res.ChecksumSHA256) {
        metadata.checksumSha256 = res.ChecksumSHA256;
      }
      return metadata;
    } catch (err) {
      if ((err as { name?: string }).name === 'NotFound') {
        throw new StorageError('OBJECT_NOT_FOUND', `Object not found: ${objectKey}`);
      }
      throw new StorageError('PROVIDER_ERROR', `HeadObject failed: ${String(err)}`);
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    const client = getR2Client();
    const bucket = getR2Bucket();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  }
}
