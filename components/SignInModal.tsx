// src/components/SignInModal.tsx
import React, { useState, useEffect } from 'react';
import { sendToN8n } from '../lib/webhook';

type Tab = 'signin' | 'signup' | 'sales';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface Props {
  open: boolean;
  defaultTab?: Tab;
  onClose: () => void;
}

const inp: React.CSSProperties = {
  fontFamily: 'Jost,sans-serif', fontSize: 14, fontWeight: 300,
  color: '#F0EBE0', background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  padding: '8px 0 12px', outline: 'none', width: '100%',
};
const lbl: React.CSSProperties = {
  fontFamily: 'Jost,sans-serif', fontSize: 9, fontWeight: 400,
  letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252',
  marginBottom: 8, display: 'block',
};
const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: 24 };

const SignInModal: React.FC<Props> = ({ open, defaultTab = 'signin', onClose }) => {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [status, setStatus] = useState<Status>('idle');
  const [err, setErr] = useState('');
  const [reqId, setReqId] = useState('');

  // fields
  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [name, setName]       = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes]     = useState('');

  useEffect(() => {
    if (open) { setTab(defaultTab); setStatus('idle'); setErr(''); }
  }, [open, defaultTab]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) { document.addEventListener('keydown', fn); document.body.style.overflow = 'hidden'; }
    return () => { document.removeEventListener('keydown', fn); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  const reset = () => { setStatus('idle'); setErr(''); };

  const submit = async (intent: Parameters<typeof sendToN8n>[0], fields: Parameters<typeof sendToN8n>[1]) => {
    if (!email.includes('@')) { setStatus('error'); setErr('Valid email required.'); return; }
    setStatus('loading'); setErr('');
    const r = await sendToN8n(intent, { email, ...fields });
    if (r.ok) { setReqId(r.requestId); setStatus('success'); }
    else      { setErr(r.error); setStatus('error'); }
  };

  const tabStyle = (t: Tab): React.CSSProperties => ({
    fontFamily: 'Jost,sans-serif', fontSize: 10, fontWeight: 400,
    letterSpacing: '2px', textTransform: 'uppercase',
    color: tab === t ? '#C9A84C' : '#6B6252',
    background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#C9A84C' : 'transparent'}`,
    padding: '10px 16px 10px 0', cursor: 'pointer', marginBottom: -1,
    transition: 'all 0.2s',
  });

  const Btn = ({ label }: { label: string }) => (
    <button type="submit" disabled={status === 'loading'} style={{
      fontFamily: 'Jost,sans-serif', fontSize: 10, fontWeight: 500,
      letterSpacing: '3px', textTransform: 'uppercase',
      color: '#000', background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C',
      border: 'none', padding: 16, width: '100%', cursor: status === 'loading' ? 'not-allowed' : 'pointer',
      marginTop: 8, transition: 'background 0.2s',
    }}>
      {status === 'loading' ? 'Sending…' : label}
    </button>
  );

  const ErrBox = () => status === 'error' ? (
    <div style={{
      fontFamily: 'Jost,sans-serif', fontSize: 12, color: '#C94C4C',
      marginBottom: 16, padding: '10px 14px',
      border: '1px solid rgba(201,76,76,0.3)', background: 'rgba(201,76,76,0.06)',
    }}>{err}</div>
  ) : null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, zIndex: 800,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#111', border: '1px solid rgba(255,255,255,0.08)',
        padding: 48, width: '100%', maxWidth: 420, position: 'relative',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 20,
          background: 'none', border: 'none', color: '#6B6252',
          fontSize: 22, cursor: 'pointer', lineHeight: 1,
        }}>×</button>

        {/* Success */}
        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 52, height: 52, border: '1px solid #C9A84C', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 300, color: '#F0EBE0', marginBottom: 10 }}>
              {tab === 'sales' ? 'Message Sent.' : "You're in."}
            </p>
            <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, marginBottom: 20 }}>
              {tab === 'sales'
                ? "We'll be in touch within one business day."
                : 'Check your inbox. Submit your first property below.'}
            </p>
            <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 9, color: 'rgba(107,98,82,0.4)', letterSpacing: 1, marginBottom: 20 }}>Ref: {reqId}</p>
            <button onClick={() => { onClose(); document.getElementById('report')?.scrollIntoView({ behavior: 'smooth' }); }} style={{
              fontFamily: 'Jost,sans-serif', fontSize: 10, fontWeight: 500,
              letterSpacing: '3px', textTransform: 'uppercase',
              color: '#000', background: '#C9A84C', border: 'none', padding: '14px 28px', cursor: 'pointer',
            }}>Submit a Property →</button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 32 }}>
              <button style={tabStyle('signin')}  onClick={() => { setTab('signin');  reset(); }}>Sign In</button>
              <button style={tabStyle('signup')}  onClick={() => { setTab('signup');  reset(); }}>Sign Up</button>
              <button style={tabStyle('sales')}   onClick={() => { setTab('sales');   reset(); }}>Sales</button>
            </div>

            {/* Sign In */}
            {tab === 'signin' && (
              <form onSubmit={e => { e.preventDefault(); submit('access_request', { notes: 'signin' }); }} noValidate>
                <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 300, color: '#F0EBE0', marginBottom: 6 }}>Welcome back.</p>
                <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 13, color: '#6B6252', marginBottom: 28, lineHeight: 1.6 }}>Sign in to your PropertyDNA account.</p>
                <ErrBox />
                <div style={fld}><label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
                <div style={fld}><label style={lbl}>Password</label><input style={inp} type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" /></div>
                <Btn label="Sign In →" />
                <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center', marginTop: 16 }}>
                  No account?{' '}
                  <button type="button" onClick={() => { setTab('signup'); reset(); }} style={{ fontFamily: 'Jost,sans-serif', fontSize: 11, color: '#C9A84C', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Create one free.
                  </button>
                </p>
              </form>
            )}

            {/* Sign Up */}
            {tab === 'signup' && (
              <form onSubmit={e => { e.preventDefault(); submit('access_request', { fullName: name, notes: 'signup' }); }} noValidate>
                <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 300, color: '#F0EBE0', marginBottom: 6 }}>Create your account.</p>
                <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 13, color: '#6B6252', marginBottom: 28, lineHeight: 1.6 }}>Free plan — 5 reports/month. No card required.</p>
                <ErrBox />
                <div style={fld}><label style={lbl}>Full Name</label><input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jordan Hayes" /></div>
                <div style={fld}><label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
                <div style={fld}><label style={lbl}>Password</label><input style={inp} type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Create a password" /></div>
                <Btn label="Create Free Account →" />
              </form>
            )}

            {/* Sales */}
            {tab === 'sales' && (
              <form onSubmit={e => { e.preventDefault(); submit('access_request', { fullName: name, company, notes: `sales: ${notes}` }); }} noValidate>
                <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 300, color: '#F0EBE0', marginBottom: 6 }}>Talk to Sales.</p>
                <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 13, color: '#6B6252', marginBottom: 28, lineHeight: 1.6 }}>We respond within one business day.</p>
                <ErrBox />
                <div style={fld}><label style={lbl}>Full Name</label><input style={inp} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jordan Hayes" /></div>
                <div style={fld}><label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required /></div>
                <div style={fld}><label style={lbl}>Company</label><input style={inp} type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Meridian Capital" /></div>
                <div style={fld}><label style={lbl}>Monthly Properties</label><input style={inp} type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 50–200" /></div>
                <Btn label="Send Message →" />
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SignInModal;
