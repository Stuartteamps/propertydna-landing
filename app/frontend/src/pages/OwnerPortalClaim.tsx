import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

type PropertyShape = {
  apn: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county_fips?: string;
  sqft?: number | null;
  year_built?: number | null;
  beds?: number | null;
  baths?: number | null;
};

type Step = 'who' | 'core' | 'extras' | 'submitted';

const RELATIONSHIPS = [
  { value: 'owner', label: 'I am the owner (on title)' },
  { value: 'co_owner', label: 'I am a co-owner (joint title)' },
  { value: 'trustee', label: 'Trustee of the owning trust / LLC' },
  { value: 'agent_of_record', label: "Owner's authorized agent" },
  { value: 'family_member', label: 'Family member (representing owner)' },
  { value: 'other', label: 'Other (explain in notes)' },
];

export default function OwnerPortalClaim() {
  const { apn } = useParams<{ apn: string }>();
  const [property, setProperty] = useState<PropertyShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('who');

  // who fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('owner');

  // core update fields (optional — owner can skip and just claim)
  const [insuranceAnnual, setInsuranceAnnual] = useState('');
  const [propertyTaxAnnual, setPropertyTaxAnnual] = useState('');
  const [openToOffers, setOpenToOffers] = useState(false);

  // extras
  const [improvements, setImprovements] = useState('');
  const [permits, setPermits] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);

  useEffect(() => {
    document.title = `Claim Property — Owner Portal — PropertyDNA`;
    if (!apn) return;
    (async () => {
      try {
        const r = await fetch(`/.netlify/functions/ticker-lookup?apn=${encodeURIComponent(apn)}`);
        const d = await r.json();
        setProperty(d?.property || d || { apn });
      } catch {
        setProperty({ apn });
      } finally {
        setLoading(false);
      }
    })();
  }, [apn]);

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError('Email is required'); return; }
    if (!apn) { setError('Missing APN'); return; }
    setSubmitting(true);

    try {
      const r = await fetch('/.netlify/functions/capture-owner-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apn,
          county_fips: property?.county_fips,
          state: property?.state,
          claimed_email: email.trim(),
          claimed_name: name.trim() || null,
          claimed_phone: phone.trim() || null,
          relationship,
          updates: {
            insurance_annual: insuranceAnnual ? Number(insuranceAnnual) : null,
            property_tax_annual: propertyTaxAnnual ? Number(propertyTaxAnnual) : null,
            open_to_offers: openToOffers,
            improvements: improvements.trim() || null,
            permits: permits.trim() || null,
            private_notes: privateNotes.trim() || null,
          },
          source: 'web_owner_portal',
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || 'Submission failed. Email stuartteamps@gmail.com.'); return; }
      setClaimId(d.claim_id || 'pending');
      setStep('submitted');
    } catch {
      setError('Network error. Try again, or email stuartteamps@gmail.com.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e7eb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <Link to="/owner-portal" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>← Owner Portal</Link>
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 12, fontWeight: 600 }}>Claim This Property</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 38, lineHeight: 1.15, margin: 0, fontWeight: 400, color: '#fafafa' }}>
            {loading ? 'Loading property…' : (property?.address || `APN ${apn}`)}
          </h1>
          {property && !loading && (
            <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 14 }}>
              {[property.city, property.state, property.zip].filter(Boolean).join(', ')}
              {property.sqft ? ` · ${property.sqft.toLocaleString()} sqft` : ''}
              {property.year_built ? ` · built ${property.year_built}` : ''}
            </div>
          )}
          <div style={{ marginTop: 14, display: 'inline-block', padding: '6px 12px', background: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#94a3b8', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
            Status: Pending verification
          </div>
        </div>

        {step !== 'submitted' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            <StepDot label="Who" active={step === 'who'} done={step !== 'who'} />
            <StepDot label="Core facts" active={step === 'core'} done={step === 'extras'} />
            <StepDot label="Improvements" active={step === 'extras'} done={false} />
          </div>
        )}

        <form onSubmit={submitClaim} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 28 }}>
          {step === 'who' && (
            <>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa', margin: '0 0 18px', fontWeight: 400 }}>1. Who are you?</h2>
              <Field label="Full name">
                <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Email *">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} required />
              </Field>
              <Field label="Phone (optional)">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Your relationship to this property *">
                <select value={relationship} onChange={(e) => setRelationship(e.target.value)} style={inputStyle}>
                  {RELATIONSHIPS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => { if (!email.trim()) { setError('Email is required'); return; } setError(null); setStep('core'); }} style={primaryBtn}>Continue →</button>
              </div>
            </>
          )}

          {step === 'core' && (
            <>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa', margin: '0 0 6px', fontWeight: 400 }}>2. Core facts (optional)</h2>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 18 }}>These help us calibrate the carrying-cost picture. Skip any you don't know.</p>
              <Field label="Current annual insurance premium ($)">
                <input value={insuranceAnnual} onChange={(e) => setInsuranceAnnual(e.target.value)} placeholder="e.g. 4800" style={inputStyle} />
              </Field>
              <Field label="Current annual property tax ($)">
                <input value={propertyTaxAnnual} onChange={(e) => setPropertyTaxAnnual(e.target.value)} placeholder="e.g. 12300" style={inputStyle} />
              </Field>
              <Field label="Open to off-market offers?">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', color: '#cbd5e1', fontSize: 14 }}>
                  <input type="checkbox" checked={openToOffers} onChange={(e) => setOpenToOffers(e.target.checked)} />
                  Yes — show "Open to offers" indicator on my property page after verification.
                </label>
              </Field>
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setStep('who')} style={secondaryBtn}>← Back</button>
                <button type="button" onClick={() => setStep('extras')} style={primaryBtn}>Continue →</button>
              </div>
            </>
          )}

          {step === 'extras' && (
            <>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#fafafa', margin: '0 0 6px', fontWeight: 400 }}>3. Improvements & notes (optional)</h2>
              <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 18 }}>Free-text. Document upload comes in Phase 2.</p>
              <Field label="Improvements / remodels (year + what was done)">
                <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={4} style={{ ...inputStyle, fontFamily: 'inherit' }} placeholder="e.g. 2022 kitchen + primary bath remodel, 2023 solar 8.4kW + battery, 2024 ADU 600sqft" />
              </Field>
              <Field label="Permits we may have missed">
                <textarea value={permits} onChange={(e) => setPermits(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'inherit' }} />
              </Field>
              <Field label="Private notes (visible only to you)">
                <textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} rows={3} style={{ ...inputStyle, fontFamily: 'inherit' }} />
              </Field>
              {error && <div style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>{error}</div>}
              <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setStep('core')} style={secondaryBtn}>← Back</button>
                <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.5 : 1 }}>
                  {submitting ? 'Submitting…' : 'Submit Claim'}
                </button>
              </div>
            </>
          )}

          {step === 'submitted' && (
            <>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#34d399', margin: '0 0 14px', fontWeight: 400 }}>Claim received.</h2>
              <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.7, marginBottom: 14 }}>
                Reference: <code style={{ color: '#fbbf24' }}>{claimId}</code>
              </p>
              <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.7, marginBottom: 14 }}>
                Your claim has entered the Data Integrity Office queue with status <strong style={{ color: '#94a3b8' }}>Pending verification</strong>.
                We've sent a confirmation to <strong>{email}</strong>. Any improvements or facts you submitted are tagged
                "pending review" and do not currently influence the public valuation shown on this property's page.
              </p>
              <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
                When identity verification ships (Phase 2), we'll email you to complete it and unlock the
                <strong style={{ color: '#34d399' }}> Owner-verified</strong> badge.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to={`/ticker/${apn}`} style={{ ...primaryBtnAsLink }}>View public property page →</Link>
                <Link to="/data-integrity/owner-rights" style={{ ...secondaryBtnAsLink }}>Read owner rights</Link>
              </div>
            </>
          )}
        </form>

        <div style={{ marginTop: 32, padding: 20, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          <strong style={{ color: '#cbd5e1' }}>Disclaimer.</strong> Submitting a claim does not by itself grant any verified status, nor does it move the
          publicly displayed valuation. PropertyDNA is an intelligence platform, not a brokerage, investment adviser, or securities exchange.
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', background: '#0a0a0a', border: '1px solid #374151',
  borderRadius: 4, color: '#fafafa', fontSize: 15,
};
const primaryBtn: React.CSSProperties = {
  padding: '12px 24px', background: '#fbbf24', color: '#0a0a0a', border: 'none',
  borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '12px 24px', background: 'transparent', color: '#cbd5e1', border: '1px solid #374151',
  borderRadius: 4, fontSize: 14, cursor: 'pointer',
};
const primaryBtnAsLink: React.CSSProperties = { ...primaryBtn, textDecoration: 'none', display: 'inline-block' };
const secondaryBtnAsLink: React.CSSProperties = { ...secondaryBtn, textDecoration: 'none', display: 'inline-block' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, letterSpacing: 2, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

function StepDot({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  const bg = done ? '#34d399' : active ? '#fbbf24' : '#1f2937';
  const fg = done || active ? '#0a0a0a' : '#94a3b8';
  return (
    <div style={{ flex: 1, padding: '8px 12px', background: bg, color: fg, borderRadius: 4, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>
      {label}
    </div>
  );
}
