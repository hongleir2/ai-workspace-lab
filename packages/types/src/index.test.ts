import { describe, expect, it } from 'vitest';
import type { OrganizationId, UserId } from './index.js';

describe('branded ids', () => {
  it('preserves underlying string identity at runtime', () => {
    const u = 'user_123' as UserId;
    const o = 'org_123' as OrganizationId;
    expect(u).toBe('user_123');
    expect(o).toBe('org_123');
  });
});
