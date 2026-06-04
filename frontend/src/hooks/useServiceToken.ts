import { useContext } from 'react';
import {
  ServiceTokenContext,
  type ServiceTokenContextValue,
} from '../contexts/ServiceTokenContext';

export function useServiceToken(): ServiceTokenContextValue {
  const context = useContext(ServiceTokenContext);
  if (context === undefined) {
    throw new Error(
      'useServiceToken must be used within a ServiceTokenProvider',
    );
  }
  return context;
}

export default useServiceToken;
