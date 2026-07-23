import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";

import { ApiClient, ApiError } from "../api/client";
import { decideBootstrap, type MeOutcome } from "../lib/session";

const TOKEN_KEY = "performance_os_token";

interface AuthState {
  token: string | null;
  onboarded: boolean;
  loading: boolean;
  api: ApiClient;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setOnboarded: (v: boolean) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [loading, setLoading] = useState(true);

  // ApiClient reads the freshest token from state each request.
  const tokenRef = React.useRef<string | null>(null);
  tokenRef.current = token;
  const api = useMemo(() => new ApiClient(() => tokenRef.current), []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        let outcome: MeOutcome | null = null;
        if (saved) {
          try {
            const me = await api.request<{ onboarded: boolean }>("/auth/me");
            outcome = { ok: true, onboarded: me.onboarded };
          } catch (e) {
            // ApiError (e.g. 401 expired) → clear session; a bare network error → keep + retry.
            outcome = e instanceof ApiError ? { ok: false, status: e.status } : null;
          }
        }
        const decision = decideBootstrap(saved, outcome);
        if (decision.keepToken && saved) {
          setToken(saved);
          setOnboarded(decision.onboarded);
        } else {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setToken(null);
          setOnboarded(false);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);

  const persist = useCallback(async (t: string, ob: boolean) => {
    await SecureStore.setItemAsync(TOKEN_KEY, t);
    setToken(t);
    setOnboarded(ob);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await persist(res.access_token, res.onboarded);
    },
    [api, persist],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await api.register(email, password);
      await persist(res.access_token, res.onboarded);
    },
    [api, persist],
  );

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setOnboarded(false);
  }, []);

  const value: AuthState = {
    token,
    onboarded,
    loading,
    api,
    login,
    register,
    logout,
    setOnboarded,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
