import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import AuthModal from '@/components/AuthModal';
import { isNative } from '@/lib/nativeFeatures';

const linkStyle: React.CSSProperties = {
  fontFamily: 'Jost, sans-serif', fontSize: '11px', fontWeight: 400,
  letterSpacing: '2px', textTransform: 'uppercase', color: '#6B6252',
  background: 'none', border: 'none', cursor: 'pointer',
  transition: 'color 0.2s', padding: 0, textDecoration: 'none',
};

// Three visitors, three questions. Everything else is footer.
//   Analyze  → "What's this house worth?" — address search → DNA report
//   Network  → "Show me what you know"    — NPIN rollup (heatmap, dossiers, ticker, IntellaGraph AI)
//   Owners   → "I own a home"             — Owner Portal claim + watchlist
const navLinks = [
  { label: 'Analyze', href: '/analyze' },
  { label: 'Network', href: '/network'  },
  { label: 'Owners',  href: '/owner-portal' },
];

interface NavProps {
  onSignInClick?: () => void;
  onRequestAccessClick?: () => void;
}

const Nav: React.FC<NavProps> = ({ onSignInClick, onRequestAccessClick }) => {
  const [scrolled, setScrolled]     = useState(false);
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalView, setModalView]   = useState<'signin' | 'pricing'>('signin');
  const [menuOpen, setMenuOpen]     = useState(false);
  const location  = useLocation();
  const navigate  = useNavigate();
  const isHome    = location.pathname === '/';
  const { user, signOut, tier } = useAuth();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const openSignIn = () => { setModalView('signin'); setModalOpen(true); onSignInClick?.(); };

  // "Get Started" — always goes to /analyze
  const openPricing = () => {
    onRequestAccessClick?.();
    navigate('/analyze');
  };

  const avatarUrl   = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const initial     = displayName[0]?.toUpperCase() || '?';

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(20px,4vw,48px)', height: '64px',
        background: scrolled ? 'rgba(0,0,0,0.97)' : 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        transition: 'background 0.3s ease',
      }}>
        {/* Logo + accuracy strapline */}
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          fontFamily: 'Jost, sans-serif', fontSize: '12px', fontWeight: 500,
          letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0', textDecoration: 'none',
        }}>
          <div style={{ width: 28, height: 28, border: '1px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" stroke="#C9A84C" strokeWidth="1"/>
              <line x1="7" y1="1" x2="7" y2="13" stroke="#C9A84C" strokeWidth="0.75"/>
              <line x1="1" y1="7" x2="13" y2="7" stroke="#C9A84C" strokeWidth="0.75"/>
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span>PropertyDNA</span>
            {/* Trust strapline — links to the methodology so the claim is one click from proof */}
            <Link
              to="/data-integrity/methodology"
              style={{
                fontFamily: 'Jost, sans-serif', fontSize: 8, letterSpacing: '1.4px',
                color: '#6B6252', textDecoration: 'none', marginTop: 2,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              VALUATION + RISK · TRANSPARENT METHODOLOGY
            </Link>
          </div>
        </Link>

        {/* Center links — desktop */}
        <ul style={{ display: 'flex', gap: '24px', listStyle: 'none', margin: 0, padding: 0 }}>
          {navLinks.map(({ label, href }) => (
            <li key={label} style={{ display: window.innerWidth < 900 ? 'none' : undefined }}>
              <Link to={href} style={linkStyle}
                onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}
              >{label}</Link>
            </li>
          ))}
        </ul>

        {/* Right — auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user ? (
            /* Signed-in state */
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Tier badge — hidden on iOS (Apple Guideline 3.1.1: no
                  references to paid plans in the iOS app) */}
              {tier !== 'free' && !isNative() && (
                <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)', padding: '4px 8px' }}>
                  {tier === 'enterprise' ? 'Enterprise' : 'Pro'}
                </div>
              )}
              {/* Avatar button */}
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative' }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(201,168,76,0.4)', display: 'block' }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: 14, fontWeight: 300, color: '#000' }}>
                    {initial}
                  </div>
                )}
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 58, right: 'clamp(20px,4vw,48px)',
                  background: '#111', border: '1px solid rgba(255,255,255,0.1)',
                  minWidth: 200, zIndex: 600, padding: '8px 0',
                }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#F0EBE0' }}>{displayName}</div>
                    <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, color: '#6B6252' }}>{user.email}</div>
                  </div>
                  {(isNative()
                    ? [
                        { label: 'Dashboard', href: '/dashboard' },
                        { label: 'Delete Account', href: '/dashboard#delete-account' },
                      ]
                    : [
                        { label: 'Dashboard', href: '/dashboard' },
                        { label: 'Manage Plan', action: openPricing },
                        { label: 'Delete Account', href: '/dashboard#delete-account' },
                      ]
                  ).map(item => (
                    <div key={item.label}>
                      {item.href ? (
                        <Link to={item.href} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '10px 16px', fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#F0EBE0', textDecoration: 'none', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}
                        >{item.label}</Link>
                      ) : (
                        <button onClick={() => { item.action?.(); setMenuOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#F0EBE0', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#F0EBE0')}
                        >{item.label}</button>
                      )}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 4 }}>
                    <button onClick={() => { signOut(); setMenuOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontFamily: 'Jost, sans-serif', fontSize: 12, color: '#6B6252', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Signed-out state — Sign In hidden on iOS (Guideline 2.1(a)
                broken Apple Sign-In + 3.1.1 no external content access) */
            <>
              {!isNative() && <button onClick={openSignIn} style={linkStyle}
                onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}
              >Sign In</button>}
              {/* Pricing CTA hidden on iOS — Apple Guideline 3.1.1. */}
              {!isNative() && <button
                onClick={openPricing}
                style={{
                  fontFamily: 'Jost, sans-serif', fontSize: '10px', fontWeight: 500,
                  letterSpacing: '2px', textTransform: 'uppercase',
                  color: '#000', background: '#C9A84C', border: 'none',
                  padding: '10px 20px', cursor: 'pointer', transition: 'background 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E8C96A')}
                onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
              >
                Get Started
              </button>}
            </>
          )}
        </div>
      </nav>

      {/* Auth modal — managed here so it persists across pages */}
      <AuthModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setMenuOpen(false); }}
        initialView={modalView}
      />
    </>
  );
};

export default Nav;
