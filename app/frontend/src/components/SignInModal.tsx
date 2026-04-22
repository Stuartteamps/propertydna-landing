import { useEffect, useState, FormEvent } from 'react';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SignInModal({ open, onClose }: SignInModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKey);
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const close = () => {
    setSubmitted(false);
    setEmail('');
    setPassword('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(15, 14, 13, 0.75)', backdropFilter: 'blur(6px)' }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-md bg-canvas border border-rule"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 text-warmgray hover:text-warmdark !bg-transparent"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="p-10 md:p-12">
          {submitted ? (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-12 h-12 border border-gold rounded-full flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke="#B89355">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="font-serif text-2xl font-light text-warmdark">Welcome back</div>
              <div className="text-[13px] text-warmgray">
                A secure sign-in link has been sent to your email.
              </div>
              <button
                type="button"
                onClick={close}
                className="mt-4 font-sans text-[11px] uppercase tracking-[3px] text-gold !bg-transparent"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="font-sans text-[10px] tracking-[3px] uppercase text-gold mb-3">
                Sign In
              </div>
              <div className="font-serif text-3xl font-light text-warmdark leading-tight mb-2">
                Welcome back to <em className="italic text-gold">PropertyDNA.</em>
              </div>
              <div className="text-[13px] text-warmgray leading-relaxed mb-8">
                Enter your credentials to access your intelligence dashboard.
              </div>

              <form onSubmit={onSubmit} className="flex flex-col">
                <div className="field">
                  <label htmlFor="signin-email">Email Address</label>
                  <input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                  <div className="field-line" />
                </div>
                <div className="field">
                  <label htmlFor="signin-password">Password</label>
                  <input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <div className="field-line" />
                </div>

                <button type="submit" className="submit-btn mt-2">
                  <span>Sign In  →</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}