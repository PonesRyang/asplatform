import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AdminUser } from '../types/auth';
import { authApi } from '../services/authApi';
import { getAdminToken, setAdminToken, clearAdminToken } from '../utils/token';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
export interface AuthContextValue {
  adminUser: AdminUser | null;
  adminToken: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // -----------------------------------------------------------------------
  // Verify existing token against /api/auth/me
  // -----------------------------------------------------------------------
  const checkAuth = useCallback(async (): Promise<boolean> => {
    const storedToken = getAdminToken();
    if (!storedToken) {
      setIsLoading(false);
      return false;
    }

    try {
      const user = await authApi.getMe();
      setAdminTokenState(storedToken);
      setAdminUser(user);
      setIsLoading(false);
      return true;
    } catch {
      // Token expired or invalid — clean up
      clearAdminToken();
      setAdminTokenState(null);
      setAdminUser(null);
      setIsLoading(false);
      return false;
    }
  }, []);

  // -----------------------------------------------------------------------
  // On mount: check localStorage for existing token and verify it
  // -----------------------------------------------------------------------
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // -----------------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------------
  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const response = await authApi.login({ username, password });
      const token = response.access_token;
      setAdminToken(token);
      setAdminTokenState(token);
      // Fetch user info separately
      try {
        const user = await authApi.getMe();
        setAdminUser(user);
      } catch { /* user info is non-critical */ }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
  const logout = useCallback((): void => {
    clearAdminToken();
    setAdminTokenState(null);
    setAdminUser(null);
  }, []);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------
  const value: AuthContextValue = {
    adminUser,
    adminToken,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
