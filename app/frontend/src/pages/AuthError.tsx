import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function AuthError() {
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  const rawMsg = searchParams.get('msg') || searchParams.get('error_description') || '';
  const errorCode = searchParams.get('error') || '';

  const friendlyMessage = (() => {
    if (rawMsg.toLowerCase().includes('provider') || rawMsg.toLowerCase().includes('not enabled')) {
      return 'That sign-in method is not fully configured yet. Please use email or Facebook to continue.';
    }
    if (rawMsg.toLowerCase().includes('expired') || rawMsg.toLowerCase().includes('invalid')) {
      return 'Your sign-in link has expired. Please request a new one.';
    }
    if (rawMsg.toLowerCase().includes('email')) {
      return 'There was an issue with your email sign-in. Please try again.';
    }
    return rawMsg || 'Something went wrong with sign-in. Please try again.';
  })();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) { clearInterval(timer); window.location.href = '/'; return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0F0E0D', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        {/* Icon */}
        <div style={{ width: 64, height: 64, border: '1px solid rgba(185,82,69,0.4)', borderRadius: '50%', margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B85245" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: '#B85245', marginBottom: 16 }}>
          Sign-In Error {errorCode ? `· ${errorCode}` : ''}
        </div>

        <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 300, color: '#F0EBE0', marginBottom: 16, lineHeight: 1.15 }}>
          Unable to sign in.
        </div>

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: '#6B6252', lineHeight: 1.8, marginBottom: 40, maxWidth: 360, margin: '0 auto 40px' }}>
          {friendlyMessage}
        </div>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          <a
            href="/"
            style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#000', background: '#C9A84C', padding: '14px 28px', textDecoration: 'none', display: 'inline-block', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#cfa366')}
            onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
          >
            Try Again →
          </a>
          <a
            href="/contact"
            style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#6B6252', border: '1px solid rgba(255,255,255,0.12)', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'; e.currentTarget.style.color = '#C9A84C'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#6B6252'; }}
          >
            Contact Support
          </a>
        </div>

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 11, color: 'rgba(107,98,82,0.5)', letterSpacing: 1 }}>
          {countdown > 0 ? `Returning to home in ${countdown}s` : 'Redirecting…'}
        </div>
      </div>
    </div>
  );
}
