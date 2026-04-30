import { useSearchParams } from 'react-router-dom';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import PropertyForm from '@/components/PropertyForm';
import FadeUp from '@/components/FadeUp';

const reportFeatures = [
  ['01', 'Data quality score A+ through C, graded on completeness and source confidence'],
  ['02', 'Live market valuation with range low, mid, and high — plus confidence level'],
  ['03', 'Buyer, seller, and investment narrative based purely on verified data'],
  ['04', 'A direct "Would We Buy It?" verdict — Yes, Maybe, or Needs Review'],
];

export default function Analyze() {
  const [searchParams] = useSearchParams();
  const initialAddress = searchParams.get('address') || '';

  return (
    <div style={{ background: '#0F0E0D', color: '#F4F0E8', minHeight: '100vh' }}>
      <Nav />

      <section style={{
        paddingTop: 'clamp(100px, 12vw, 140px)',
        paddingBottom: 'clamp(60px, 8vw, 100px)',
        paddingLeft: 'clamp(24px, 6vw, 80px)',
        paddingRight: 'clamp(24px, 6vw, 80px)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Page header */}
          <FadeUp>
            <div style={{ marginBottom: 64 }}>
              <div style={{
                fontFamily: 'Jost, sans-serif', fontSize: 10,
                letterSpacing: '4px', textTransform: 'uppercase',
                color: '#B89355', marginBottom: 16,
              }}>
                Property Intelligence
              </div>
              <h1 style={{
                fontFamily: 'Cormorant Garamond, Georgia, serif',
                fontSize: 'clamp(38px, 5vw, 64px)',
                fontWeight: 300, letterSpacing: '-1px', lineHeight: 1.05,
                color: '#F4F0E8', margin: 0,
              }}>
                Analyze any{' '}
                <em style={{ fontStyle: 'italic', color: '#B89355' }}>property.</em>
              </h1>
            </div>
          </FadeUp>

          {/* Two-column layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '48px 80px',
            alignItems: 'start',
          }}>

            {/* Left: description + what you get */}
            <FadeUp delay={0.04}>
              <p style={{
                fontFamily: 'Jost, sans-serif', fontSize: 15, fontWeight: 300,
                lineHeight: 1.85, color: 'rgba(244,240,232,0.6)',
                maxWidth: 440, marginBottom: 48, marginTop: 0,
              }}>
                Submit an address and receive a fully formatted intelligence report —
                property vitals, verified valuation, buyer and seller analysis,
                climate context, and a direct verdict on whether we'd buy it.
                Delivered in under three minutes.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {reportFeatures.map(([num, text]) => (
                  <div key={num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{
                      fontFamily: 'Cormorant Garamond, Georgia, serif',
                      fontSize: 15, color: '#B89355', lineHeight: 1.7, flexShrink: 0,
                    }}>
                      {num}
                    </div>
                    <div style={{
                      fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300,
                      lineHeight: 1.8, color: 'rgba(244,240,232,0.65)',
                    }}>
                      {text}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 48,
                padding: '20px 24px',
                border: '1px solid rgba(184,147,85,0.15)',
                background: 'rgba(184,147,85,0.04)',
              }}>
                <div style={{
                  fontFamily: 'Jost, sans-serif', fontSize: 10,
                  letterSpacing: '2px', textTransform: 'uppercase',
                  color: '#B89355', marginBottom: 10,
                }}>
                  Pricing
                </div>
                {[
                  ['First report', 'Free'],
                  ['Per report after that', '$4.99'],
                  ['Unlimited monthly', '$49 / mo'],
                  ['Enterprise', '$149 / mo'],
                ].map(([label, price]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: 'Jost, sans-serif', fontSize: 13, fontWeight: 300,
                    color: 'rgba(244,240,232,0.55)', padding: '6px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span>{label}</span>
                    <span style={{ color: '#F4F0E8' }}>{price}</span>
                  </div>
                ))}
              </div>
            </FadeUp>

            {/* Right: the form */}
            <FadeUp delay={0.08}>
              <div style={{
                border: '1px solid rgba(184,147,85,0.2)',
                padding: 'clamp(28px, 4vw, 48px)',
                background: '#111111',
              }}>
                <div style={{ marginBottom: 32 }}>
                  <div style={{
                    fontFamily: 'Cormorant Garamond, Georgia, serif',
                    fontSize: 22, fontWeight: 300, color: '#F0EBE0', marginBottom: 8,
                  }}>
                    Submit a Property
                  </div>
                  <div style={{
                    fontFamily: 'Jost, sans-serif', fontSize: 13,
                    fontWeight: 300, color: '#6B6252', lineHeight: 1.6,
                  }}>
                    Enter the address below. First report is always free.
                  </div>
                </div>
                <PropertyForm initialAddress={initialAddress} />
              </div>
            </FadeUp>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
