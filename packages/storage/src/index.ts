export { StorageError } from './errors';
export type { StorageErrorCode } from './errors';

export type {
  CreateUploadTargetParams,
  ObjectMetadata,
  StorageProvider,
  UploadObjectParams,
  UploadTarget,
} from './types';

export {
  ALLOWED_FILE_EXTENSIONS,
  DEFAULT_MAX_FILE_SIZE_MB,
  getMaxFileSizeMb,
  validateFileSize,
  validateFileType,
} from './validation';
export type { AllowedFileExtension } from './validation';

export { getStorageProvider } from './providers/index';

export {
  createStorageObjectRow,
  createUploadTarget,
  deleteObject,
  getObjectMetadata,
  uploadObject,
} from './service';
export type { CreateStorageObjectRowParams, CreateUploadTargetInput } from './service';
