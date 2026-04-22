// src/components/Nav.tsx
import React from 'react';

interface Props {
  onSignIn: () => void;
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

const NAV_LINKS = [
  { label: 'Platform', id: 'platform' },
  { label: 'Insights', id: 'insights' },
  { label: 'Pricing',  id: 'pricing'  },
  { label: 'About',    id: 'about'    },
];

const Nav: React.FC<Props> = ({ onSignIn }) => (
  <nav style={{
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
    height: 64, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 48px',
    background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  }}>

    {/* Logo */}
    <button onClick={() => scrollTo('hero')} style={s.logo}>
      <span style={s.logoIcon}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="12" height="12" stroke="#C9A84C" strokeWidth="1"/>
          <line x1="7" y1="1" x2="7" y2="13" stroke="#C9A84C" strokeWidth="0.75"/>
          <line x1="1" y1="7" x2="13" y2="7" stroke="#C9A84C" strokeWidth="0.75"/>
        </svg>
      </span>
      PropertyDNA
    </button>

    {/* Center links */}
    <ul style={{ display: 'flex', gap: 32, listStyle: 'none', margin: 0, padding: 0 }}>
      {NAV_LINKS.map(({ label, id }) => (
        <li key={id}>
          <button onClick={() => scrollTo(id)} style={s.link}
            onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}>
            {label}
          </button>
        </li>
      ))}
    </ul>

    {/* Right actions */}
    <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <button onClick={onSignIn} style={s.link}
        onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}>
        Sign In
      </button>
      <button onClick={() => scrollTo('report')} style={s.cta}
        onMouseEnter={e => (e.currentTarget.style.background = '#E8C96A')}
        onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}>
        Request Access
      </button>
    </div>
  </nav>
);

const s: Record<string, React.CSSProperties> = {
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    fontFamily: 'Jost, sans-serif', fontSize: 12,
    fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase',
    color: '#F0EBE0', background: 'none', border: 'none', cursor: 'pointer',
  },
  logoIcon: {
    width: 28, height: 28, border: '1px solid #C9A84C',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  link: {
    fontFamily: 'Jost, sans-serif', fontSize: 11, fontWeight: 400,
    letterSpacing: '2px', textTransform: 'uppercase',
    color: '#6B6252', background: 'none', border: 'none',
    cursor: 'pointer', transition: 'color 0.2s', padding: 0,
  },
  cta: {
    fontFamily: 'Jost, sans-serif', fontSize: 10, fontWeight: 500,
    letterSpacing: '2px', textTransform: 'uppercase',
    color: '#000', background: '#C9A84C', border: 'none',
    padding: '10px 22px', cursor: 'pointer', transition: 'background 0.2s',
  },
};

export default Nav;
