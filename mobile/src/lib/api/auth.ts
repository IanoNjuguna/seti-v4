import { post } from './client';
import type { AuthUser } from '@/contexts/auth.types';

interface DevLoginResponse {
  user: AuthUser;
  token: string;
}

/**
 * Development-only bypass login.
 *
 * This hits `POST /auth/dev`, which is only enabled when the backend has
 * `DEV_BYPASS_AUTH=true`. Use it to test the app without configuring Privy.
 */
export async function devLogin(): Promise<DevLoginResponse> {
  return post<DevLoginResponse>('/auth/dev', {});
}
