import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequireUser, mockCreateOrganization, mockCaptureServerEvent, mockRedirect, mockHeaders } =
  vi.hoisted(() => ({
    mockRequireUser: vi.fn(),
    mockCreateOrganization: vi.fn(),
    mockCaptureServerEvent: vi.fn(),
    mockRedirect: vi.fn(),
    mockHeaders: vi.fn().mockResolvedValue({ get: () => null }),
  }));

vi.mock('@/lib/auth/user', () => ({ requireUser: mockRequireUser }));
vi.mock('@/lib/orgs/service', () => ({
  createOrganization: mockCreateOrganization,
  OrgSlugConflictError: class OrgSlugConflictError extends Error {},
  OrgSlugInvalidError: class OrgSlugInvalidError extends Error {},
}));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: mockCaptureServerEvent }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('next/headers', () => ({ headers: mockHeaders }));

import { createOrganizationAction } from './actions';

describe('createOrganizationAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('captures organization_created after successful org creation', async () => {
    mockRequireUser.mockResolvedValue({ id: 'user-1' });
    mockCreateOrganization.mockResolvedValue({
      organization: { id: 'org-1', slug: 'acme' },
    });
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    const fd = new FormData();
    fd.set('name', 'Acme Corp');
    await expect(createOrganizationAction(fd)).rejects.toThrow('NEXT_REDIRECT');

    expect(mockCaptureServerEvent).toHaveBeenCalledWith('user-1', 'organization_created', {
      org_id: 'org-1',
      org_slug: 'acme',
    });
  });

  it('does not capture event when org creation fails', async () => {
    mockRequireUser.mockResolvedValue({ id: 'user-1' });
    mockCreateOrganization.mockRejectedValue(new Error('DB error'));

    const fd = new FormData();
    fd.set('name', 'Acme Corp');
    await expect(createOrganizationAction(fd)).rejects.toThrow('DB error');

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
