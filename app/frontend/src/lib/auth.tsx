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
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null, session: null, tier: 'free', plan: null, loading: true,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signInWithFacebook: async () => {},
  signInWithEmail: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tier, setTier]       = useState<Tier>('free');
  const [plan, setPlan]       = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTier(email: string) {
    try { sessionStorage.setItem('pdna_email', email.toLowerCase().trim()); } catch {}
    const { tier: t, plan: p } = await fetchUserTier(email);
    setTier(t);
    setPlan(p);
    try {
      sessionStorage.setItem('pdna_subscribed', t !== 'free' ? 'true' : 'false');
      sessionStorage.setItem('pdna_plan', p ?? '');
    } catch {}
  }

  async function upsertProfile(authUser: User) {
    try {
      await fetch('/.netlify/functions/upsert-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:          authUser.email,
          fullName:       authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
          avatarUrl:      authUser.user_metadata?.avatar_url || null,
          provider:       authUser.app_metadata?.provider || 'email',
          supabaseUserId: authUser.id,
        }),
      });
    } catch { /* non-blocking */ }
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user?.email) {
        loadTier(s.user.email);
        // Capture every sign-in in our database
        if (event === 'SIGNED_IN' && s.user) upsertProfile(s.user);
      } else {
        setTier('free');
        setPlan(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Google sign-in is not configured. Please use email or Facebook.');
  }

  async function signInWithApple() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Apple sign-in is not configured yet. Please use email or Facebook.');
  }

  async function signInWithFacebook() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Facebook sign-in is not configured. Please use email.');
  }

  async function signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
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
    <AuthContext.Provider value={{ user, session, tier, plan, loading, signInWithGoogle, signInWithApple, signInWithFacebook, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
