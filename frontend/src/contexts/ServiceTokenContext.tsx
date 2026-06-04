import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { VerifyTokenResponse } from '../types/auth';
import { authApi } from '../services/authApi';
import {
  getServiceToken,
  setServiceToken,
  clearServiceToken,
} from '../utils/token';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
export interface ServiceTokenContextValue {
  serviceToken: string | null;
  tokenInfo: VerifyTokenResponse | null;
  isValid: boolean;
  isVerifying: boolean;
  verifyToken: (token: string) => Promise<boolean>;
  clearToken: () => void;
}

export const ServiceTokenContext = createContext<
  ServiceTokenContextValue | undefined
>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ServiceTokenProvider({ children }: { children: ReactNode }) {
  const [serviceToken, setServiceTokenState] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<VerifyTokenResponse | null>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(true);

  // -----------------------------------------------------------------------
  // Verify a service token against the backend
  // -----------------------------------------------------------------------
  const verifyToken = useCallback(
    async (token: string): Promise<boolean> => {
      setIsVerifying(true);
      try {
        const info = await authApi.verifyServiceToken(token);
        setTokenInfo(info);
        setIsValid(info.valid);
        if (info.valid) {
          setServiceToken(token);
          setServiceTokenState(token);
        }
        return info.valid;
      } catch {
        setTokenInfo(null);
        setIsValid(false);
        return false;
      } finally {
        setIsVerifying(false);
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Clear token
  // -----------------------------------------------------------------------
  const clearToken = useCallback((): void => {
    clearServiceToken();
    setServiceTokenState(null);
    setTokenInfo(null);
    setIsValid(false);
  }, []);

  // -----------------------------------------------------------------------
  // On mount: check localStorage for existing service token and auto-verify
  // -----------------------------------------------------------------------
  useEffect(() => {
    const existingToken = getServiceToken();
    if (existingToken) {
      verifyToken(existingToken);
    } else {
      setIsVerifying(false);
    }
  }, [verifyToken]);

  // -----------------------------------------------------------------------
  // Context value
  // -----------------------------------------------------------------------
  const value: ServiceTokenContextValue = {
    serviceToken,
    tokenInfo,
    isValid,
    isVerifying,
    verifyToken,
    clearToken,
  };

  return (
    <ServiceTokenContext.Provider value={value}>
      {children}
    </ServiceTokenContext.Provider>
  );
}

export default ServiceTokenProvider;
