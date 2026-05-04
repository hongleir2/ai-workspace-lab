export type EntitlementErrorCode =
  | 'FEATURE_NOT_INCLUDED'
  | 'QUOTA_EXCEEDED'
  | 'NO_ACTIVE_SUBSCRIPTION'
  | 'PLAN_NOT_FOUND';

export class EntitlementError extends Error {
  readonly code: EntitlementErrorCode;

  constructor(code: EntitlementErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'EntitlementError';
    this.code = code;
  }
}
