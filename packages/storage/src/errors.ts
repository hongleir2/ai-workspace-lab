export type StorageErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PROVIDER_ERROR'
  | 'DATABASE_ERROR'
  | 'OBJECT_NOT_FOUND'
  | 'NOT_AUTHORIZED';

export class StorageError extends Error {
  constructor(
    public readonly code: StorageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
