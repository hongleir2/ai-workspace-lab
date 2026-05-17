import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSignIn, mockCaptureServerEvent, mockRedirect } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockCaptureServerEvent: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { signInWithPassword: mockSignIn } }),
}));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: mockCaptureServerEvent }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

import { signInAction } from './actions';

function buildForm(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', password);
  return fd;
}

describe('signInAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('captures user_signed_in after successful sign-in', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null });
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(signInAction(buildForm('user@example.com', 'pass'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(mockCaptureServerEvent).toHaveBeenCalledWith('user-2', 'user_signed_in', {
      email: 'user@example.com',
    });
  });

  it('does not capture event on sign-in error', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid credentials' } });
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(signInAction(buildForm('user@example.com', 'wrong'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
