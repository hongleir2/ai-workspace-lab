import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSignUp, mockCaptureServerEvent, mockRedirect, mockAppUrl } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockCaptureServerEvent: vi.fn(),
  mockRedirect: vi.fn(),
  mockAppUrl: vi.fn(() => 'https://app.example.com'),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { signUp: mockSignUp } }),
}));
vi.mock('@/lib/analytics/server', () => ({ captureServerEvent: mockCaptureServerEvent }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_APP_URL: 'https://app.example.com' },
  appUrl: mockAppUrl,
}));

import { signUpAction } from './actions';

function buildForm(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', password);
  return fd;
}

describe('signUpAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('captures user_signed_up after successful sign-up', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(signUpAction(buildForm('test@example.com', 'password123'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(mockCaptureServerEvent).toHaveBeenCalledWith('user-1', 'user_signed_up', {
      email: 'test@example.com',
    });
  });

  it('does not capture event on sign-up error', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'Email taken' } });
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });

    await expect(signUpAction(buildForm('test@example.com', 'password123'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
