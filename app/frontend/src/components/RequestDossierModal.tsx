import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type Props = {
  open: boolean;
  onClose: () => void;
  apn?: string;
  propertyAddress?: string;
  pedigreeTier?: string | null;
  sourcePage: string;
};

const ROLES = ['Owner', 'Listing agent', 'Buyer / buyer agent', 'Broker', 'Press / publication', 'Other'];

export default function RequestDossierModal({ open, onClose, apn, propertyAddress, pedigreeTier, sourcePage }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError('Email is required'); return; }
    setSubmitting(true);

    const params = new URLSearchParams(window.location.search);
    const { error: insertErr } = await supabase.from('dossier_requests').insert({
      apn: apn || null,
      source_page: sourcePage,
      property_address: propertyAddress || null,
      full_name: name.trim() || null,
      email: email.trim(),
      phone: phone.trim() || null,
      role: role || null,
      message: message.trim() || null,
      pedigree_tier: pedigreeTier || null,
      utm_source:    params.get('utm_source') || null,
      utm_medium:    params.get('utm_medium') || null,
      utm_campaign:  params.get('utm_campaign') || null,
    });

    if (insertErr) {
      setError('Could not submit request. Please email stuartteamps@gmail.com directly.');
      setSubmitting(false);
      return;
    }

    // Best-effort notification (don't block on it)
    fetch('/.netlify/functions/dossier-request-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apn, propertyAddress, name, email, phone, role, message, pedigreeTier, sourcePage }),
    }).catch(() => {});

    setDone(true);
    setSubmitting(false);
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 9999,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#0f172a', borderRadius: 8, border: '1px solid #334155',
        maxWidth: 520, width: '100%', maxHeight: '92vh', overflow: 'auto',
        padding: '36px 32px', color: '#e5e7eb',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 24, background: 'transparent', color: '#94a3b8',
          border: 'none', fontSize: 24, cursor: 'pointer', lineHeight: 1,
        }}>×</button>

        {done ? (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>Received</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, margin: '0 0 16px', color: '#fafafa', fontWeight: 400 }}>Thank you.</h2>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              We've received your dossier request{propertyAddress ? ` for ${propertyAddress}` : ''}.
              Dan will reach out personally within 24 hours.
            </p>
            <button onClick={onClose} style={{
              marginTop: 24, padding: '12px 24px', background: '#fbbf24', color: '#0a0a0a',
              border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1,
              textTransform: 'uppercase', cursor: 'pointer',
            }}>Close</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>Request Dossier</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, margin: '0 0 8px', color: '#fafafa', fontWeight: 400 }}>
              {propertyAddress ? 'Build a verified dossier for' : 'Request a verified luxury dossier'}
            </h2>
            {propertyAddress && (
              <div style={{ color: '#fbbf24', fontSize: 15, marginBottom: 18 }}>{propertyAddress}</div>
            )}
            <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, marginBottom: 22 }}>
              We compile verified provenance — architect attribution, celebrity ownership, press history, scarcity benchmarking — for $5M+ luxury estates. Sotheby's charges 15%. We build it as a PropertyDNA service.
            </p>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
                style={inputStyle} />
              <input type="email" placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} required
                style={inputStyle} />
              <input type="tel" placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)}
                style={inputStyle} />
              <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
                <option value="">Your role…</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea placeholder={propertyAddress ? 'Tell us about this property (sale plans, listing timeline, etc.)' : 'Tell us about your property and what you need…'}
                value={message} onChange={e => setMessage(e.target.value)} rows={4} style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }} />

              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}

              <button type="submit" disabled={submitting} style={{
                marginTop: 4, padding: '14px 24px', background: '#fbbf24', color: '#0a0a0a',
                border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: 1,
                textTransform: 'uppercase', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}>{submitting ? 'Sending…' : 'Request Dossier'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px', background: '#1e293b', color: '#e5e7eb',
  border: '1px solid #334155', borderRadius: 4, fontSize: 14, outline: 'none',
};
