// src/components/Nav.tsx
import React, { useState, useEffect } from 'react';

interface NavProps {
  onSignInClick: () => void;
  onRequestAccessClick: () => void;
}

const Nav: React.FC<NavProps> = ({ onSignInClick, onRequestAccessClick }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        height: '64px',
        background: scrolled ? 'rgba(0,0,0,0.96)' : 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        transition: 'background 0.3s ease',
      }}
    >
      {/* Logo */}
      <a
        href="#hero"
        onClick={(e) => { e.preventDefault(); scrollToSection('hero'); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontFamily: 'Jost, sans-serif',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: '#F0EBE0',
          textDecoration: 'none',
        }}
      >
        <div style={{
          width: '28px', height: '28px',
          border: '1px solid #C9A84C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" stroke="#C9A84C" strokeWidth="1"/>
            <line x1="7" y1="1" x2="7" y2="13" stroke="#C9A84C" strokeWidth="0.75"/>
            <line x1="1" y1="7" x2="13" y2="7" stroke="#C9A84C" strokeWidth="0.75"/>
          </svg>
        </div>
        PropertyDNA
      </a>

      {/* Center links */}
      <ul style={{ display: 'flex', gap: '36px', listStyle: 'none', margin: 0, padding: 0 }}>
        {[
          { label: 'Platform', target: 'platform' },
          { label: 'Insights', target: 'insights' },
          { label: 'Pricing',  target: 'pricing'  },
          { label: 'About',    target: 'about'    },
        ].map(({ label, target }) => (
          <li key={target}>
            <button
              onClick={() => scrollToSection(target)}
              style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: '11px',
                fontWeight: 400,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: '#6B6252',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.2s',
                padding: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <button
          onClick={onSignInClick}
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: '11px',
            fontWeight: 400,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#6B6252',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F0EBE0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6B6252')}
        >
          Sign In
        </button>

        <button
          onClick={onRequestAccessClick}
          style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#000000',
            background: '#C9A84C',
            border: 'none',
            padding: '10px 22px',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#E8C96A')}
          onMouseLeave={e => (e.currentTarget.style.background = '#C9A84C')}
        >
          Request Access
        </button>
      </div>
    </nav>
  );
};

export default Nav;
