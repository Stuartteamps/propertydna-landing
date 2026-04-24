// src/components/SignInModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { submitToN8n } from '../lib/webhook';

type Tab = 'signin' | 'signup' | 'sales';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface SignInModalProps {
  isOpen: boolean;
  initialTab?: Tab;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: '14px',
  fontWeight: 300,
  color: '#F0EBE0',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  padding: '8px 0 12px',
  outline: 'none',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: '9px',
  fontWeight: 400,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#6B6252',
  marginBottom: '8px',
  display: 'block',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '24px',
};

const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  initialTab = 'signin',
  onClose,
}) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [requestId, setRequestId] = useState('');

  // Sign in fields
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');

  // Sign up fields
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');

  // Sales fields
  const [slName, setSlName] = useState('');
  const [slEmail, setSlEmail] = useState('');
  const [slCompany, setSlCompany] = useState('');
  const [slNotes, setSlNotes] = useState('');

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setStatus('idle');
      setErrorMsg('');
    }
  }, [isOpen, initialTab]);

  // ESC to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose]
  );
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // ── SUBMIT HANDLERS ───────────────────────────────────

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siEmail.includes('@')) {
      setStatus('error'); setErrorMsg('Please enter a valid email.'); return;
    }
    setStatus('loading'); setErrorMsg('');

    // Sign-in is an access_request — n8n can handle auth or just log it
    const result = await submitToN8n('access_request', {
      email: siEmail,
      notes: 'sign_in_attempt',
    });

    if (result.success) {
      setRequestId(result.requestId);
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suEmail.includes('@')) {
      setStatus('error'); setErrorMsg('Please enter a valid email.'); return;
    }
    setStatus('loading'); setErrorMsg('');

    const result = await submitToN8n('access_request', {
      fullName: suName,
      email: suEmail,
      notes: 'signup_request',
    });

    if (result.success) {
      setRequestId(result.requestId);
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  };

  const handleSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slEmail.includes('@')) {
      setStatus('error'); setErrorMsg('Please enter a valid email.'); return;
    }
    setStatus('loading'); setErrorMsg('');

    const result = await submitToN8n('access_request', {
      fullName: slName,
      email: slEmail,
      company: slCompany,
      notes: `sales_inquiry: ${slNotes}`,
    });

    if (result.success) {
      setRequestId(result.requestId);
      setStatus('success');
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  };

  // ── SUCCESS STATE ─────────────────────────────────────
  const SuccessView = () => (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{
        width: '52px', height: '52px',
        border: '1px solid #C9A84C',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{
        fontFamily: 'Cormorant Garamond, Georgia, serif',
        fontSize: '26px', fontWeight: 300, color: '#F0EBE0', marginBottom: '10px',
      }}>
        {tab === 'sales' ? 'Message Sent.' : "You're in."}
      </div>
      <div style={{
        fontFamily: 'Jost, sans-serif',
        fontSize: '13px', color: '#6B6252', lineHeight: 1.7, marginBottom: '24px',
      }}>
        {tab === 'sales'
          ? "We'll be in touch within one business day."
          : 'Check your inbox for next steps. In the meantime, submit your first property.'}
      </div>
      <div style={{
        fontFamily: 'Jost, sans-serif',
        fontSize: '9px', color: 'rgba(107,98,82,0.4)', letterSpacing: '1px', marginBottom: '20px',
      }}>
        Ref: {requestId}
      </div>
      <button
        onClick={() => {
          onClose();
          const el = document.getElementById('form');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        style={{
          fontFamily: 'Jost, sans-serif',
          fontSize: '10px', fontWeight: 500,
          letterSpacing: '3px', textTransform: 'uppercase',
          color: '#000000', background: '#C9A84C',
          border: 'none', padding: '14px 28px', cursor: 'pointer',
        }}
      >
        Submit a Property →
      </button>
    </div>
  );

  // ── ERROR BANNER ──────────────────────────────────────
  const ErrorBanner = () =>
    status === 'error' ? (
      <div style={{
        fontFamily: 'Jost, sans-serif',
        fontSize: '12px', color: '#C94C4C',
        marginBottom: '16px', padding: '10px 14px',
        border: '1px solid rgba(201,76,76,0.3)',
        background: 'rgba(201,76,76,0.06)',
      }}>
        {errorMsg}
      </div>
    ) : null;

  // ── SHARED SUBMIT BUTTON ──────────────────────────────
  const SubmitBtn = ({ label }: { label: string }) => (
    <button
      type="submit"
      disabled={status === 'loading'}
      style={{
        fontFamily: 'Jost, sans-serif',
        fontSize: '10px', fontWeight: 500,
        letterSpacing: '3px', textTransform: 'uppercase',
        color: '#000000',
        background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C',
        border: 'none', padding: '16px', width: '100%',
        cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        marginTop: '8px', transition: 'background 0.2s',
      }}
    >
      {status === 'loading' ? 'Sending…' : label}
    </button>
  );

  // ── TAB BUTTON STYLE ──────────────────────────────────
  const tabBtn = (t: Tab): React.CSSProperties => ({
    fontFamily: 'Jost, sans-serif',
    fontSize: '10px', fontWeight: 400,
    letterSpacing: '2px', textTransform: 'uppercase',
    color: tab === t ? '#C9A84C' : '#6B6252',
    background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#C9A84C' : 'transparent'}`,
    padding: '10px 20px 10px 0',
    cursor: 'pointer', marginBottom: '-1px',
    transition: 'all 0.2s',
  });

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '48px',
        width: '100%', maxWidth: '440px',
        position: 'relative',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '18px', right: '20px',
            background: 'none', border: 'none',
            color: '#6B6252', fontSize: '22px', cursor: 'pointer',
            lineHeight: 1, transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}
          aria-label="Close"
        >
          ×
        </button>

        {status === 'success' ? (
          <SuccessView />
        ) : (
          <>
            {/* Tab bar */}
            <div style={{
              display: 'flex', gap: '0',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '32px',
            }}>
              <button style={tabBtn('signin')} onClick={() => { setTab('signin'); setStatus('idle'); }}>Sign In</button>
              <button style={tabBtn('signup')} onClick={() => { setTab('signup'); setStatus('idle'); }}>Create Account</button>
              <button style={tabBtn('sales')}  onClick={() => { setTab('sales');  setStatus('idle'); }}>Talk to Sales</button>
            </div>

            {/* ── SIGN IN ── */}
            {tab === 'signin' && (
              <form onSubmit={handleSignIn} noValidate>
                <div style={{
                  fontFamily: 'Cormorant Garamond, Georgia, serif',
                  fontSize: '26px', fontWeight: 300, color: '#F0EBE0', marginBottom: '6px',
                }}>Welcome back.</div>
                <div style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: '13px', color: '#6B6252', marginBottom: '28px', lineHeight: 1.6,
                }}>Sign in to your PropertyDNA account.</div>
                <ErrorBanner />
                <div style={fieldStyle}>
                  <label style={labelStyle}>Email Address</label>
                  <input style={inputStyle} type="email" value={siEmail}
                    onChange={e => setSiEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Password</label>
                  <input style={inputStyle} type="password" value={siPassword}
                    onChange={e => setSiPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <SubmitBtn label="Sign In →" />
                <div style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: '11px', color: '#6B6252', textAlign: 'center', marginTop: '16px',
                }}>
                  No account?{' '}
                  <button type="button" onClick={() => setTab('signup')}
                    style={{ color: '#C9A84C', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontFamily: 'Jost, sans-serif' }}>
                    Create one free.
                  </button>
                </div>
              </form>
            )}

            {/* ── SIGN UP ── */}
            {tab === 'signup' && (
              <form onSubmit={handleSignUp} noValidate>
                <div style={{
                  fontFamily: 'Cormorant Garamond, Georgia, serif',
                  fontSize: '26px', fontWeight: 300, color: '#F0EBE0', marginBottom: '6px',
                }}>Create your account.</div>
                <div style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: '13px', color: '#6B6252', marginBottom: '28px', lineHeight: 1.6,
                }}>Free plan — 5 reports/month. No card required.</div>
                <ErrorBanner />
                <div style={fieldStyle}>
                  <label style={labelStyle}>Full Name</label>
                  <input style={inputStyle} type="text" value={suName}
                    onChange={e => setSuName(e.target.value)} placeholder="Jordan Hayes" required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Email Address</label>
                  <input style={inputStyle} type="email" value={suEmail}
                    onChange={e => setSuEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Password</label>
                  <input style={inputStyle} type="password" value={suPassword}
                    onChange={e => setSuPassword(e.target.value)} placeholder="Create a password" required />
                </div>
                <SubmitBtn label="Create Free Account →" />
              </form>
            )}

            {/* ── SALES ── */}
            {tab === 'sales' && (
              <form onSubmit={handleSales} noValidate>
                <div style={{
                  fontFamily: 'Cormorant Garamond, Georgia, serif',
                  fontSize: '26px', fontWeight: 300, color: '#F0EBE0', marginBottom: '6px',
                }}>Talk to Sales.</div>
                <div style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: '13px', color: '#6B6252', marginBottom: '28px', lineHeight: 1.6,
                }}>We'll be in touch within one business day.</div>
                <ErrorBanner />
                <div style={fieldStyle}>
                  <label style={labelStyle}>Full Name</label>
                  <input style={inputStyle} type="text" value={slName}
                    onChange={e => setSlName(e.target.value)} placeholder="Jordan Hayes" required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Email Address</label>
                  <input style={inputStyle} type="email" value={slEmail}
                    onChange={e => setSlEmail(e.target.value)} placeholder="you@company.com" required />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Company</label>
                  <input style={inputStyle} type="text" value={slCompany}
                    onChange={e => setSlCompany(e.target.value)} placeholder="Meridian Capital" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Monthly Properties (approx.)</label>
                  <input style={inputStyle} type="text" value={slNotes}
                    onChange={e => setSlNotes(e.target.value)} placeholder="e.g. 50–200" />
                </div>
                <SubmitBtn label="Send Message →" />
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SignInModal;
