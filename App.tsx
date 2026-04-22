// src/App.tsx
// Root — wires Nav + SignInModal + PropertyForm.
// The rest of your page content goes between Nav and the #report section.

import React, { useState } from 'react';
import Nav from './components/Nav';
import SignInModal from './components/SignInModal';
import PropertyForm from './components/PropertyForm';

type ModalTab = 'signin' | 'signup' | 'sales';

const App: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab]   = useState<ModalTab>('signin');

  const openModal = (tab: ModalTab = 'signin') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#F0EBE0' }}>

      <Nav onSignIn={() => openModal('signin')} />

      <SignInModal
        open={modalOpen}
        defaultTab={modalTab}
        onClose={() => setModalOpen(false)}
      />

      {/*
       * ── YOUR EXISTING PAGE SECTIONS GO HERE ──────────────────────────
       * Keep your hero, platform, insights, pricing, about sections as-is.
       * Just make sure the pricing "Start Free Trial" button calls:
       *   openModal('signup')
       * and "Talk to Sales" calls:
       *   openModal('sales')
       *
       * If you need those buttons, pass openModal down as a prop or use
       * a simple context. The simplest approach: add onClick directly
       * in your existing section JSX.
       * ─────────────────────────────────────────────────────────────────
       */}

      {/* ── REPORT SECTION — required id="report" ── */}
      <section id="report" style={{
        background: '#000', padding: '100px 72px',
        display: 'grid', gridTemplateColumns: '1fr 1.1fr',
        gap: 100, alignItems: 'start',
      }}>
        {/* Left copy */}
        <div>
          <p style={{
            fontFamily: 'Jost,sans-serif', fontSize: 10, letterSpacing: '4px',
            textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16,
          }}>Request Intelligence</p>
          <h2 style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 'clamp(32px,3.5vw,52px)', fontWeight: 300,
            lineHeight: 1.1, color: '#F0EBE0', marginBottom: 20,
          }}>
            Sequence any <em style={{ color: '#C9A84C' }}>property.</em>
          </h2>
          <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 14, fontWeight: 300, color: '#6B6252', lineHeight: 1.9, marginBottom: 40 }}>
            Submit an address and receive a fully formatted intelligence report —
            property vitals, verified valuation, buyer and seller analysis,
            and a direct verdict on whether we'd buy it.
          </p>
          {[
            ['01', 'Data quality score A+ through C based on source completeness'],
            ['02', 'Live market valuation with range low, range high, and confidence'],
            ['03', 'Buyer, seller, and investment narrative based on verified data'],
            ['04', 'A direct "Would We Buy It?" verdict — Yes, Maybe, or Needs Review'],
          ].map(([n, t]) => (
            <div key={n} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 11, color: '#C9A84C', minWidth: 20, marginTop: 2 }}>{n}</span>
              <span style={{ fontFamily: 'Jost,sans-serif', fontSize: 13, color: 'rgba(240,235,224,0.55)', lineHeight: 1.65 }}>{t}</span>
            </div>
          ))}
        </div>

        {/* Form box */}
        <div style={{
          background: '#111', border: '1px solid rgba(255,255,255,0.08)', padding: 48,
        }}>
          <p style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 28, fontWeight: 300, color: '#F0EBE0', marginBottom: 6 }}>
            Submit a Property
          </p>
          <p style={{ fontFamily: 'Jost,sans-serif', fontSize: 12, color: '#6B6252', marginBottom: 36, lineHeight: 1.6 }}>
            Free report. No account required. Delivered by email within minutes.
          </p>
          <PropertyForm />
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '40px 72px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'Jost,sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '3px', textTransform: 'uppercase', color: '#F0EBE0' }}>
          PropertyDNA
        </span>
        <span style={{ fontFamily: 'Jost,sans-serif', fontSize: 11, color: '#6B6252', maxWidth: 420, textAlign: 'right', lineHeight: 1.6 }}>
          Reports are for informational purposes only. Not a licensed appraisal or legal advice. © 2026 PropertyDNA.
        </span>
      </footer>
    </div>
  );
};

export default App;
