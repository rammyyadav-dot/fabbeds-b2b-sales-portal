import { useState, useCallback } from 'react';

export type PartnerSession = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  hotelId?: string;
  hotelName?: string;
};

const SESSION_KEY = 'partner_session';

function readSession(): PartnerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PartnerSession) : null;
  } catch {
    return null;
  }
}

export function usePartnerAuth() {
  const [user, setUser] = useState<PartnerSession | null>(() => readSession());

  const login = useCallback((session: PartnerSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return { user, login, logout };
}
