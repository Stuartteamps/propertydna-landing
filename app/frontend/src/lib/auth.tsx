import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { planToTier, fetchUserTier, type Tier } from './tier';

interface AuthState {
  user: User | null;
  session: Session | null;
  tier: Tier;
  plan: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null, session: null, tier: 'free', plan: null, loading: true,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signInWithFacebook: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tier, setTier]       = useState<Tier>('free');
  const [plan, setPlan]       = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTier(email: string) {
    try {
      sessionStorage.setItem('pdna_email', email.toLowerCase().trim());
    } catch {}
    const { tier: t, plan: p } = await fetchUserTier(email);
    setTier(t);
    setPlan(p);
    try {
      sessionStorage.setItem('pdna_subscribed', t !== 'free' ? 'true' : 'false');
      sessionStorage.setItem('pdna_plan', p ?? '');
    } catch {}
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) loadTier(s.user.email).finally(() => setLoading(false));
      else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) loadTier(s.user.email);
      else { setTier('free'); setPlan(null); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  }

  // Requires Apple Developer account + Service ID configured in Supabase Auth → Providers → Apple
  async function signInWithApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  // Requires Meta app with Facebook Login enabled in Supabase Auth → Providers → Facebook
  async function signInWithFacebook() {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTier('free');
    setPlan(null);
    try {
      sessionStorage.removeItem('pdna_email');
      sessionStorage.removeItem('pdna_subscribed');
      sessionStorage.removeItem('pdna_plan');
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, session, tier, plan, loading, signInWithGoogle, signInWithApple, signInWithFacebook, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
