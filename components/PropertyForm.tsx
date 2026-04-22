// src/components/PropertyForm.tsx
import React, { useState } from 'react';
import { sendToN8n } from '../lib/webhook';

type Role = 'Buyer' | 'Seller' | 'Agent' | 'Investor' | 'Lender';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface F {
  fullName: string; email: string; phone: string; role: Role;
  address: string; city: string; state: string; zip: string; notes: string;
}

const ROLES: Role[] = ['Buyer', 'Seller', 'Agent', 'Investor', 'Lender'];

const inp: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300,
  color: '#F0EBE0', background: 'transparent', border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  padding: '8px 0 12px', outline: 'none', width: '100%',
};
const lbl: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: 9, fontWeight: 400,
  letterSpacing: '3px', textTransform: 'uppercase', color: '#6B6252',
  marginBottom: 8, display: 'block',
};
const fld: React.CSSProperties = { display: 'flex', flexDirection: 'column', marginBottom: 28 };

const PropertyForm: React.FC = () => {
  const [f, setF] = useState<F>({
    fullName: '', email: '', phone: '', role: 'Buyer',
    address: '', city: '', state: '', zip: '', notes: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [err, setErr] = useState('');
  const [reqId, setReqId] = useState('');

  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.email.includes('@')) { setStatus('error'); setErr('Valid email required.'); return; }
    if (!f.address.trim())      { setStatus('error'); setErr('Property address required.'); return; }
    setStatus('loading'); setErr('');

    const r = await sendToN8n('report_request', {
      fullName: f.fullName, email: f.email, phone: f.phone,
      address: f.address, city: f.city, state: f.state, zip: f.zip,
      notes: `Role: ${f.role}. ${f.notes}`.trim(),
    });

    if (r.ok) { setReqId(r.requestId); setStatus('success'); }
    else      { setErr(r.error); setStatus('error'); }
  };

  if (status === 'success') return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <div style={{
        width: 56, height: 56, border: '1px solid #C9A84C', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, fontWeight: 300, color: '#F0EBE0', marginBottom: 12 }}>
        Report Initiated
      </p>
      <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 13, color: '#6B6252', lineHeight: 1.7, marginBottom: 12 }}>
        Check your inbox — delivery is typically 2–4 minutes.
      </p>
      <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 10, color: 'rgba(107,98,82,0.4)', letterSpacing: 1 }}>
        Ref: {reqId}
      </p>
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {/* Name + Email */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <div style={fld}>
          <label style={lbl}>Full Name</label>
          <input style={inp} type="text" value={f.fullName} onChange={set('fullName')} placeholder="Jordan Hayes" />
        </div>
        <div style={fld}>
          <label style={lbl}>Email Address *</label>
          <input style={inp} type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" required />
        </div>
      </div>

      {/* Phone */}
      <div style={fld}>
        <label style={lbl}>Phone (optional)</label>
        <input style={inp} type="tel" value={f.phone} onChange={set('phone')} placeholder="+1 760 555 0100" />
      </div>

      {/* Role */}
      <div style={{ marginBottom: 28 }}>
        <span style={lbl}>I Am A</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ROLES.map(r => (
            <button key={r} type="button" onClick={() => setF(p => ({ ...p, role: r }))} style={{
              fontFamily: 'Jost,sans-serif', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase',
              color: f.role === r ? '#000' : '#6B6252',
              background: f.role === r ? '#C9A84C' : 'transparent',
              border: `1px solid ${f.role === r ? '#C9A84C' : 'rgba(255,255,255,0.08)'}`,
              padding: '7px 14px', cursor: 'pointer', transition: 'all 0.2s',
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Address */}
      <div style={fld}>
        <label style={lbl}>Property Address *</label>
        <input style={inp} type="text" value={f.address} onChange={set('address')} placeholder="100 W Andreas Rd" required />
      </div>

      {/* City + State */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <div style={fld}>
          <label style={lbl}>City</label>
          <input style={inp} type="text" value={f.city} onChange={set('city')} placeholder="Palm Springs" />
        </div>
        <div style={fld}>
          <label style={lbl}>State</label>
          <input style={inp} type="text" value={f.state} onChange={set('state')} placeholder="CA" maxLength={2} />
        </div>
      </div>

      {/* ZIP */}
      <div style={fld}>
        <label style={lbl}>ZIP Code</label>
        <input style={inp} type="text" value={f.zip} onChange={set('zip')} placeholder="92262" maxLength={10} />
      </div>

      {/* Notes */}
      <div style={fld}>
        <label style={lbl}>Notes (optional)</label>
        <textarea style={{ ...inp, resize: 'none', height: 64 }} value={f.notes} onChange={set('notes')}
          placeholder="Any context about the property..." />
      </div>

      {/* Error */}
      {status === 'error' && (
        <div style={{
          fontFamily: 'Jost,sans-serif', fontSize: 12, color: '#C94C4C',
          marginBottom: 16, padding: '10px 14px',
          border: '1px solid rgba(201,76,76,0.3)', background: 'rgba(201,76,76,0.06)',
        }}>{err}</div>
      )}

      {/* Submit */}
      <button type="submit" disabled={status === 'loading'} style={{
        fontFamily: 'Jost,sans-serif', fontSize: 10, fontWeight: 500,
        letterSpacing: '3px', textTransform: 'uppercase',
        color: '#000', background: status === 'loading' ? 'rgba(201,168,76,0.5)' : '#C9A84C',
        border: 'none', padding: 18, width: '100%',
        cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s', marginBottom: 12,
      }}>
        {status === 'loading' ? 'Sequencing…' : 'Sequence This Property →'}
      </button>

      <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 11, color: '#6B6252', textAlign: 'center' }}>
        Free · No account required · Delivered by email
      </p>
    </form>
  );
};

export default PropertyForm;
