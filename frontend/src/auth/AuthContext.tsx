import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as endpoints from '../api/endpoints';
import { loadTokens, saveTokens } from '../api/http';
import type { User } from '../api/types';

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!loadTokens()) {
      setUserState(null);
      return null;
    }
    try {
      const me = await endpoints.getMe();
      setUserState(me);
      return me;
    } catch {
      setUserState(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
    const onExpired = () => {
      saveTokens(null);
      setUserState(null);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await endpoints.login(email, password);
    saveTokens({ access: result.access, refresh: result.refresh });
    setUserState(result.user);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    const tokens = loadTokens();
    if (tokens?.refresh) {
      try {
        await endpoints.logoutRemote(tokens.refresh);
      } catch {
        /* the token may already be expired; signing out locally is what matters */
      }
    }
    saveTokens(null);
    setUserState(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut, refreshUser, setUser: setUserState }),
    [user, loading, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
