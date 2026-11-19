import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { partnerSession } from 'zitejs/api';

export interface PartnerProfile {
  id: string;
  agencyEmail: string;
  agencyName: string;
  businessType?: string;
  agencyMobile?: string;
  country?: string;
  city?: string;
  creditLimit: number;
  creditStatus: string;
  creditTermsDays: number;
}

interface PartnerAuthState {
  partner: PartnerProfile | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, partner: PartnerProfile) => void;
  signOut: () => void;
}

const TOKEN_KEY = 'partner_token';
const PartnerAuthContext = createContext<PartnerAuthState>({
  partner: null,
  token: null,
  isLoading: true,
  signIn: () => {},
  signOut: () => {},
});

export function PartnerAuthProvider({ children }: { children: ReactNode }) {
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setToken(null);
      setIsLoading(false);
      return;
    }
    partnerSession({ token: storedToken })
      .then(res => {
        if (res.valid && res.partner) {
          const activeToken = res.token || storedToken;
          if (res.token) localStorage.setItem(TOKEN_KEY, res.token);
          setPartner(res.partner as PartnerProfile);
          setToken(activeToken);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = useCallback((nextToken: string, p: PartnerProfile) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setPartner(p);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setPartner(null);
  }, []);

  return (
    <PartnerAuthContext.Provider value={{ partner, token, isLoading, signIn, signOut }}>
      {children}
    </PartnerAuthContext.Provider>
  );
}

export function usePartnerAuth() {
  return useContext(PartnerAuthContext);
}
