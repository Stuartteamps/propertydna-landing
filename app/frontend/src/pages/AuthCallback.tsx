import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * OAuth redirect landing page.
 *
 * supabase-js runs the PKCE flow (default): Google redirects back here with a
 * `?code=`, and the client (detectSessionInUrl:true) exchanges it for a session
 * ASYNCHRONOUSLY. The old version fired a single getSession() and, if the
 * exchange hadn't finished — or had FAILED (e.g. the redirect landed on a
 * different origin than login started on, so the code-verifier was missing) —
 * silently navigated home, which reads as "login didn't work."
 *
 * Now we: (1) surface an explicit provider error, (2) resolve as soon as the
 * session lands (onAuthStateChange) OR is already present (poll), and (3) after
 * a bounded wait, send the user to /auth/error with a real message instead of
 * dumping them back on the home page with no explanation.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let settled = false;
    const go = (path: string) => {
      if (settled) return;
      settled = true;
      navigate(path, { replace: true });
    };

    // 1) Provider returned an explicit error (query or hash) — show it.
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const errCode = url.searchParams.get('error') || hash.get('error');
    const errDesc = url.searchParams.get('error_description') || hash.get('error_description');
    if (errCode) {
      go(`/auth/error?error=${encodeURIComponent(errCode)}&msg=${encodeURIComponent(errDesc || errCode)}`);
      return;
    }

    // 2) The code exchange is async; SIGNED_IN / INITIAL_SESSION fires when done.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go('/dashboard');
    });

    // 3) Fallback poll — covers the exchange completing before this mounted (no
    //    event) and provides a bounded failure path if it never completes.
    let tries = 0;
    const poll = window.setInterval(async () => {
      tries += 1;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        go('/dashboard');
      } else if (tries >= 12) { // ~6s
        go('/auth/error?error=no_session&msg=' + encodeURIComponent(
          'Sign-in could not be completed. If this keeps happening, the site’s redirect URL may not be authorized. Please try again.'));
      }
    }, 500);

    return () => {
      subscription.unsubscribe();
      window.clearInterval(poll);
    };
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>
          Signing you in…
        </div>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#C9A84C' }}>
          PropertyDNA
        </div>
      </div>
    </div>
  );
}
