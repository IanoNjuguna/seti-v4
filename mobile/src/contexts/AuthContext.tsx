import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { post, setAuthToken } from '@/lib/api/client';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from './auth.constants';
import type { AuthContextValue, AuthUser } from './auth.types';

interface VerifyResponse {
  user: AuthUser;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function getStoredString(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setStoredString(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // SecureStore can fail on web or in unusual environments; the session
    // will simply not persist across reloads in those cases.
  }
}

async function removeStoredItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore cleanup failures.
  }
}

async function verifyToken(token: string): Promise<AuthUser> {
  const { user } = await post<VerifyResponse>('/auth/verify', { token });
  return user;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedToken = await getStoredString(AUTH_TOKEN_KEY);

      if (!storedToken) {
        return;
      }

      // Re-verify the token with the backend on every cold start so the
      // local user record stays in sync and expired tokens are rejected.
      const verifiedUser = await verifyToken(storedToken);
      setToken(storedToken);
      setUser(verifiedUser);
      await setStoredString(AUTH_USER_KEY, JSON.stringify(verifiedUser));

      if (__DEV__) {
        console.log('[Auth] session restored for', verifiedUser.email);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[Auth] session restore failed', error);
      }
      // Clear stale credentials so the user is forced to sign in again.
      await removeStoredItem(AUTH_TOKEN_KEY);
      await removeStoredItem(AUTH_USER_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Session restoration runs once on mount and updates React state with
  // the verified user from SecureStore. This is legitimate initialization
  // code, not a cascading-render bug.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const signIn = useCallback(async (newToken: string, newUser: AuthUser) => {
    await setStoredString(AUTH_TOKEN_KEY, newToken);
    await setStoredString(AUTH_USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const signOut = useCallback(async () => {
    await removeStoredItem(AUTH_TOKEN_KEY);
    await removeStoredItem(AUTH_USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      signIn,
      signOut,
    }),
    [user, token, isLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
