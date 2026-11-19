import { useState, useCallback } from 'react';

export type AppSession = {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  role: string;
};

const SESSION_KEY = 'tms_session';

function readSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AppSession) : null;
  } catch {
    return null;
  }
}

export function getSessionUserId(): string | undefined {
  return readSession()?.id;
}

export function useAppAuth() {
  const [user, setUser] = useState<AppSession | null>(() => readSession());

  const login = useCallback((session: AppSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  return { user, isLoading: false, login, logout };
}
