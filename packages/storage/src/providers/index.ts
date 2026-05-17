import { StorageError } from '../errors';
import type { StorageProvider } from '../types';
import { R2StorageProvider } from './r2';
import { SupabaseStorageProvider } from './supabase';

export function getStorageProvider(): StorageProvider {
  const provider = process.env['STORAGE_PROVIDER'];
  if (provider === 'r2') return new R2StorageProvider();
  if (provider === 'supabase') return new SupabaseStorageProvider();
  throw new StorageError(
    'PROVIDER_ERROR',
    'STORAGE_PROVIDER env var must be set to "r2" or "supabase"',
  );
}
