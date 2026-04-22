// src/App.tsx
// Root component — wires Nav, SignInModal, PropertyForm together.
// Drop this into your existing Vite/React app.

import React, { useState } from 'react';
import Nav from './components/Nav';
import SignInModal from './components/SignInModal';
import PropertyForm from './components/PropertyForm';

type ModalTab = 'signin' | 'signup' | 'sales';

const App: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('signin');

  const openModal = (tab: ModalTab = 'signin') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Nav
        onSignInClick={() => openModal('signin')}
        // "Request Access" scrolls to the property form section
        onRequestAccessClick={() => scrollTo('report')}
      />

      <SignInModal
        isOpen={modalOpen}
        initialTab={modalTab}
        onClose={() => setModalOpen(false)}
      />

      {/*
        ── HOW TO USE PropertyForm IN YOUR PAGE ──────────────────────
        Place <PropertyForm /> inside the section with id="report".
        Example:

        <section id="report" style={{ ... }}>
          <div className="form-left">
            <h2>Sequence any property.</h2>
            ...
          </div>
          <div className="form-box">
            <PropertyForm />
          </div>
        </section>

        The form handles its own loading, success, and error states.
        ────────────────────────────────────────────────────────────── */}

      {/* Demo section so this file renders standalone */}
      <section
        id="report"
        style={{
          minHeight: '100vh',
          paddingTop: '100px',
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{
          background: '#111111',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '48px',
          width: '100%',
          maxWidth: '560px',
        }}>
          <div style={{
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            fontSize: '28px', fontWeight: 300,
            color: '#F0EBE0', marginBottom: '6px',
          }}>
            Submit a Property
          </div>
          <div style={{
            fontFamily: 'Jost, sans-serif',
            fontSize: '12px', color: '#6B6252',
            marginBottom: '36px', lineHeight: 1.6,
          }}>
            Your report will be emailed within minutes.
          </div>
          <PropertyForm />
        </div>
      </section>
    </>
  );
};

export default App;
