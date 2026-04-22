import { useState, useEffect } from 'react';
import SignInModal from './SignInModal';

const links = [
  { id: 'platform', label: 'Platform' },
  { id: 'insights', label: 'Insights' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'about', label: 'About' },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = (id: string) => {
    scrollToId(id);
    setOpen(false);
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 transition-all"
        style={{
          background: scrolled ? 'rgba(15, 14, 13, 0.85)' : 'rgba(15, 14, 13, 0.55)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(184,147,85,0.15)',
        }}
      >
        <button
          type="button"
          onClick={() => scrollToId('hero')}
          className="font-sans text-[11px] tracking-[4px] font-medium text-canvas !bg-transparent"
        >
          PROPERTY<span className="text-gold">DNA</span>
        </button>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => handleClick(l.id)}
              className="font-sans text-[10px] font-light uppercase tracking-[3px] text-canvas/75 hover:text-gold transition-colors !bg-transparent"
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSignInOpen(true)}
            className="font-sans text-[10px] font-light uppercase tracking-[3px] text-canvas/75 hover:text-gold transition-colors px-3 py-2 !bg-transparent"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleClick('form')}
            className="font-sans text-[10px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-5 py-2.5"
          >
            Request Access
          </button>
        </div>

        <button
          type="button"
          className="md:hidden text-canvas !bg-transparent"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        {open && (
          <div
            className="md:hidden absolute top-full left-0 right-0 flex flex-col"
            style={{
              background: 'rgba(15, 14, 13, 0.97)',
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(184,147,85,0.2)',
            }}
          >
            {links.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handleClick(l.id)}
                className="px-6 py-4 text-left font-sans text-[11px] uppercase tracking-[3px] text-canvas/80 border-b border-white/10 !bg-transparent"
              >
                {l.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSignInOpen(true);
                setOpen(false);
              }}
              className="px-6 py-4 text-left font-sans text-[11px] uppercase tracking-[3px] text-canvas/80 border-b border-white/10 !bg-transparent"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleClick('form')}
              className="px-6 py-4 text-left font-sans text-[11px] uppercase tracking-[3px] text-gold !bg-transparent"
            >
              Request Access
            </button>
          </div>
        )}
      </nav>
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}