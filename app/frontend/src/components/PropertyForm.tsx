// src/components/PropertyForm.tsx
import React, { useState } from 'react';
import PricingGate from './PricingGate';

type Role = 'Buyer' | 'Seller' | 'Agent' | 'Investor' | 'Lender';

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

const ROLES: Role[] = ['Buyer', 'Seller', 'Agent', 'Investor', 'Lender'];

const inputStyle: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif',
  fontSize: '14px',
  fontWeight: 300,
  color: '#F0EBE0',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
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
  marginBottom: '28px',
};

async function goToCheckout(formData: FormState, mode: 'free' | 'per_report' | 'subscription') {
  const res = await fetch('/.netlify/functions/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...formData, mode }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  return data;
}

const PropertyForm: React.FC = () => {
  const [form, setForm] = useState<FormState>({
    fullName: '', email: '', phone: '', role: 'Buyer',
    address: '', city: '', state: '', zip: '', notes: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [gateOpen, setGateOpen] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.includes('@')) { setStatus('error'); setErrorMsg('Please enter a valid email address.'); return; }
    if (!form.address.trim()) { setStatus('error'); setErrorMsg('Property address is required.'); return; }

    setStatus('loading');
    setErrorMsg('');

    try {
      // Check usage — is this a free first report, or does the user need to pay?
      const usageRes = await fetch('/.netlify/functions/check-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const usage = await usageRes.json().catch(() => ({ reportCount: 0, isSubscribed: false }));

      if (usage.isSubscribed) {
        // Subscribed → free
        await goToCheckout(form, 'free');
      } else if ((usage.reportCount || 0) === 0) {
        // First ever report → free
        await goToCheckout(form, 'free');
      } else {
        // Has used free report → show pricing gate
        setStatus('idle');
        setGateOpen(true);
      }
    } catch {
      // Network issue with check-usage → allow free (fail open)
      await goToCheckout(form, 'free');
    }
  };

  const handleGateSelect = async (mode: 'per_report' | 'subscription') => {
    setGateLoading(true);
    try {
      const data = await goToCheckout(form, mode);
      if (!data.url) {
        setGateLoading(false);
        setGateOpen(false);
        setStatus('error');
        setErrorMsg(data.error || 'Unable to start checkout. Please try again.');
      }
    } catch {
      setGateLoading(false);
      setGateOpen(false);
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  };

  // ── FORM ──────────────────────────────────────────────
  return (
    <>
      <PricingGate
        isOpen={gateOpen}
        email={form.email}
        address={form.address}
        formData={form as unknown as Record<string, string>}
        onClose={() => { setGateOpen(false); setStatus('idle'); }}
        onSelect={handleGateSelect}
        loading={gateLoading}
      />

      <form onSubmit={handleSubmit} noValidate>
        {/* Row: Name + Email */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Full Name</label>
            <input style={inputStyle} type="text" value={form.fullName} onChange={set('fullName')} placeholder="Jordan Hayes" autoComplete="name" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email Address</label>
            <input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" required />
          </div>
        </div>

        {/* Phone */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Phone (optional)</label>
          <input style={inputStyle} type="tel" value={form.phone} onChange={set('phone')} placeholder="+1 (760) 555-0100" autoComplete="tel" />
        </div>

        {/* Role */}
        <div style={{ marginBottom: '28px' }}>
          <span style={labelStyle}>I Am A</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {ROLES.map(r => (
              <button key={r} type="button" onClick={() => setForm(prev => ({ ...prev, role: r }))}
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: '10px', fontWeight: 300,
                  letterSpacing: '1.5px', textTransform: 'uppercase',
                  color: form.role === r ? '#000000' : '#6B6252',
                  background: form.role === r ? '#C9A84C' : 'transparent',
                  border: `1px solid ${form.role === r ? '#C9A84C' : 'rgba(255,255,255,0.08)'}`,
                  padding: '7px 14px', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >{r}</button>
            ))}
          </div>
        </div>

        {/* Address */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Property Address</label>
          <input style={inputStyle} type="text" value={form.address} onChange={set('address')} placeholder="100 W Andreas Rd" required />
        </div>

        {/* City + State */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} type="text" value={form.city} onChange={set('city')} placeholder="Palm Springs" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>State</label>
            <input style={inputStyle} type="text" value={form.state} onChange={set('state')} placeholder="CA" maxLength={2} />
          </div>
        </div>

        {/* ZIP */}
        <div style={fieldStyle}>
          <label style={labelStyle}>ZIP Code</label>
          <input style={inputStyle} type="text" value={form.zip} onChange={set('zip')} placeholder="92262" maxLength={10} />
        </div>

        {/* Notes */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea style={{ ...inputStyle, resize: 'none', height: '72px' }} value={form.notes} onChange={set('notes')} placeholder="Any additional context about the property..." />
        </div>

        {/* Error */}
        {status === 'error' && (
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: '12px', color: '#C94C4C', marginBottom: '16px', padding: '12px 16px', border: '1px solid rgba(201,76,76,0.3)', background: 'rgba(201,76,76,0.06)' }}>
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button type="submit" disabled={status === 'loading'} style={{
          fontFamily: 'Jost, sans-serif', fontSize: '10px', fontWeight: 500, letterSpacing: '3px',
          textTransform: 'uppercase', color: '#000000',
          background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C',
          border: 'none', padding: '18px', width: '100%',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s', marginBottom: '12px',
        }}>
          {status === 'loading' ? 'Checking…' : 'Sequence This Property →'}
        </button>

        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: '11px', color: '#6B6252', textAlign: 'center' }}>
          First report free · $4.99/report after · $49/month unlimited
        </div>
      </form>
    </>
  );
};

export default PropertyForm;
