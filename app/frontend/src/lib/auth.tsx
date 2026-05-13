import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { planToTier, fetchUserTier, type Tier } from './tier';

// Robust native detection — multiple signals because Capacitor's bridge
// can be slow/unreliable when loading a remote URL via server.url.
// Checks: Capacitor API, user agent, platform, then bridge object.
function detectNative(): boolean {
  try {
    if (Capacitor.isNativePlatform?.()) return true;
    if (Capacitor.getPlatform?.() === 'ios' || Capacitor.getPlatform?.() === 'android') return true;
  } catch { /* Capacitor not loaded yet */ }
  if (typeof window !== 'undefined') {
    const ua = navigator.userAgent || '';
    // Capacitor injects 'CapacitorBridge' on iOS WebView
    if ((window as any).Capacitor?.isNativePlatform?.()) return true;
    // iOS WebView in Capacitor app sends specific UA markers
    if (/PropertyDNA/i.test(ua)) return true;
  }
  return false;
}
// Read fresh inside auth functions — module-load time may be too early when WebView loads remote URL
const isNative = detectNative();

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
    try { sessionStorage.setItem('pdna_email', email.toLowerCase().trim()); } catch { /* sessionStorage unavailable */ }
    const { tier: t, plan: p } = await fetchUserTier(email);
    setTier(t);
    setPlan(p);
    try {
      sessionStorage.setItem('pdna_subscribed', t !== 'free' ? 'true' : 'false');
      sessionStorage.setItem('pdna_plan', p ?? '');
    } catch { /* sessionStorage unavailable */ }
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
    const native = detectNative();
    if (native) {
      // Native iOS/Android: only use Firebase Auth. Never fall through to Safari —
      // Apple rejects apps that open Safari for sign-in and never return (Guideline 2.1(a)).
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      if (!idToken) throw new Error('Google sign-in did not return a token. Please try email.');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) throw new Error(`Google sign-in failed: ${error.message}. Please try email.`);
      return;
    }
    // Browser only
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Google sign-in is not configured. Please use email.');
  }

  async function signInWithApple() {
    const native = detectNative();
    if (native) {
      // Native iOS: use Firebase Auth's bridge to Sign in with Apple (system sheet).
      // Never fall through to Safari — Apple rejects apps that do this.
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const result = await FirebaseAuthentication.signInWithApple();
      const idToken = result.credential?.idToken;
      const nonce = result.credential?.nonce;
      if (!idToken) throw new Error('Apple sign-in did not return a token. Please try email.');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: idToken, nonce });
      if (error) throw new Error(`Apple sign-in failed: ${error.message}. Please try email.`);
      return;
    }
    // Browser only
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Apple sign-in is not configured yet. Please use email.');
  }

  async function signInWithFacebook() {
    const native = detectNative();
    if (native) {
      // Facebook sign-in is not available in the iOS/Android app — email only.
      throw new Error('Facebook sign-in is not available in the app. Please use email.');
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Facebook sign-in is not configured. Please use email.');
  }

  async function signInWithEmail(email: string) {
    // In the Capacitor app, window.location.origin is "capacitor://localhost" — emails
    // need a real https URL. Universal Links (apple-app-site-association + assetlinks.json)
    // bounce that URL back into the app automatically.
    const native = detectNative();
    const origin = native ? 'https://thepropertydna.com' : window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { emailRedirectTo: `${origin}/auth/callback` },
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
    } catch { /* sessionStorage unavailable */ }
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
