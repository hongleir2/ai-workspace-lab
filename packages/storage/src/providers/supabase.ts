import { createClient } from '@supabase/supabase-js';
import { StorageError } from '../errors';
import type {
  CreateUploadTargetParams,
  ObjectMetadata,
  StorageProvider,
  UploadObjectParams,
  UploadTarget,
} from '../types';

function getSupabaseClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !serviceRoleKey) {
    throw new StorageError(
      'PROVIDER_ERROR',
      'Supabase credentials not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
    );
  }

  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

function getSupabaseBucket(): string {
  return process.env['SUPABASE_STORAGE_BUCKET'] ?? 'documents';
}

export class SupabaseStorageProvider implements StorageProvider {
  async createUploadTarget(params: CreateUploadTargetParams): Promise<UploadTarget> {
    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();
    const expiresInSeconds = params.expiresInSeconds ?? 900;

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(params.objectKey);

    if (error || !data) {
      throw new StorageError(
        'PROVIDER_ERROR',
        `Failed to create signed upload URL: ${error?.message ?? 'unknown'}`,
      );
    }

    return {
      uploadUrl: data.signedUrl,
      objectKey: params.objectKey,
      bucket,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async uploadObject(params: UploadObjectParams): Promise<void> {
    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();

    const { error } = await supabase.storage.from(bucket).upload(params.objectKey, params.body, {
      contentType: params.contentType,
      upsert: false,
    });

    if (error) {
      throw new StorageError('PROVIDER_ERROR', `Upload failed: ${error.message}`);
    }
  }

  async getObjectMetadata(objectKey: string): Promise<ObjectMetadata> {
    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();
    const folder = objectKey.includes('/')
      ? objectKey.substring(0, objectKey.lastIndexOf('/'))
      : '';
    const filename = objectKey.split('/').pop() ?? objectKey;

    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });

    if (error) {
      throw new StorageError('OBJECT_NOT_FOUND', `Object not found: ${objectKey}`);
    }

    const file = data?.find((f) => f.name === filename);
    if (!file) {
      throw new StorageError('OBJECT_NOT_FOUND', `Object not found: ${objectKey}`);
    }

    return {
      contentType:
        (file.metadata?.['mimetype'] as string | undefined) ?? 'application/octet-stream',
      byteSize: (file.metadata?.['size'] as number | undefined) ?? 0,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();

    const { error } = await supabase.storage.from(bucket).remove([objectKey]);
    if (error) {
      throw new StorageError('PROVIDER_ERROR', `Delete failed: ${error.message}`);
    }
  }

  async downloadObject(objectKey: string): Promise<Buffer> {
    const supabase = getSupabaseClient();
    const bucket = getSupabaseBucket();
    const { data, error } = await supabase.storage.from(bucket).download(objectKey);
    if (error || !data) {
      const msg = error?.message ?? 'unknown';
      const isNotFound =
        msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('does not exist');
      throw new StorageError(
        isNotFound ? 'OBJECT_NOT_FOUND' : 'PROVIDER_ERROR',
        `Download failed for ${objectKey}: ${msg}`,
      );
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
