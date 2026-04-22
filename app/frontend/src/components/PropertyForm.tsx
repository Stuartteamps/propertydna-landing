import { FormEvent, useState } from 'react';

const roles = ['Buyer', 'Seller', 'Real Estate Agent', 'Investor', 'Lender'] as const;
const roleShort: Record<string, string> = {
  Buyer: 'Buyer',
  Seller: 'Seller',
  'Real Estate Agent': 'Agent',
  Investor: 'Investor',
  Lender: 'Lender',
};

const ENDPOINT = 'https://dillabean.app.n8n.cloud/webhook/homefax/report';

export default function PropertyForm() {
  const [role, setRole] = useState<string>('Buyer');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [values, setValues] = useState({
    name: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });

  const update = (k: keyof typeof values, v: string) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const payload = { ...values, role };

    try {
      await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });
    } catch {
      // ignore
    }
    setSuccess(true);
    setSubmitting(false);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
        <div className="w-12 h-12 border border-gold rounded-full flex items-center justify-center mb-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke="#B89355">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="font-serif text-2xl font-light text-warmdark">Report Requested</div>
        <div className="text-[13px] text-warmgray leading-relaxed max-w-xs">
          Your PropertyDNA report is being compiled. Check your inbox — delivery typically takes 2–4 minutes.
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col" onSubmit={onSubmit} noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <div className="field">
          <label htmlFor="fname">Full Name</label>
          <input
            id="fname"
            type="text"
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Jordan Hayes"
            autoComplete="name"
            required
          />
          <div className="field-line" />
        </div>
        <div className="field">
          <label htmlFor="femail">Email Address</label>
          <input
            id="femail"
            type="email"
            value={values.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <div className="field-line" />
        </div>
      </div>

      <div className="pb-7">
        <div className="font-sans text-[9px] font-normal tracking-[3px] uppercase text-warmgray mb-3">
          I Am A
        </div>
        <div className="flex gap-2 flex-wrap">
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              className={`role-btn ${role === r ? 'active' : ''}`}
              onClick={() => setRole(r)}
            >
              {roleShort[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="faddress">Property Address</label>
        <input
          id="faddress"
          type="text"
          value={values.address}
          onChange={(e) => update('address', e.target.value)}
          placeholder="100 W Andreas Rd"
          required
        />
        <div className="field-line" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <div className="field">
          <label htmlFor="fcity">City</label>
          <input
            id="fcity"
            type="text"
            value={values.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="Palm Springs"
            required
          />
          <div className="field-line" />
        </div>
        <div className="field">
          <label htmlFor="fstate">State</label>
          <input
            id="fstate"
            type="text"
            value={values.state}
            onChange={(e) => update('state', e.target.value)}
            placeholder="CA"
            maxLength={2}
            required
          />
          <div className="field-line" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        <div className="field">
          <label htmlFor="fzip">ZIP Code</label>
          <input
            id="fzip"
            type="text"
            value={values.zip}
            onChange={(e) => update('zip', e.target.value)}
            placeholder="92262"
            maxLength={10}
            required
          />
          <div className="field-line" />
        </div>
        <div className="hidden md:block" />
      </div>

      <button type="submit" className="submit-btn" disabled={submitting}>
        <span>{submitting ? 'Sequencing…' : 'Sequence This Property  →'}</span>
      </button>
    </form>
  );
}