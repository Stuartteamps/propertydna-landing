import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import SignInModal from '@/components/SignInModal';
import { Link } from 'react-router-dom';

type ModalTab = 'signin' | 'signup' | 'sales';

const sources = [
  ['RentCast', 'Property data & AVM valuations'],
  ['FEMA', 'Flood zone & hazard maps'],
  ['US Census ACS', 'Demographics & income data'],
  ['FBI UCR', 'Crime statistics & safety index'],
  ['NWS', 'Climate & weather forecasting'],
  ['BuildZoom', 'Permit history & construction records'],
  ['SpotCrime', 'Incident-level safety data'],
  ['Anthropic AI', 'Narrative intelligence layer'],
];

const timeline = [
  ['2022', 'Origin', 'Daniel Stuart starts pulling property data manually for investment decisions. The gap between what agents present and what the data actually shows is too wide to ignore.'],
  ['2023', 'Engine Built', 'First version of the PropertyDNA engine built. 12 data sources cross-referenced into a single report. Delivery time: 45 minutes.'],
  ['2024', 'Automation', 'n8n workflow automation reduces delivery to under 3 minutes. AI narrative layer added. First institutional clients onboarded.'],
  ['2025', 'Platform Launch', 'PropertyDNA launches as a subscription platform. 47 data sources, 14.3M properties indexed, and a live heat map layer.'],
];

export default function About() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('signin');

  const openModal = (tab: ModalTab = 'signin') => {
    setModalTab(tab);
    setModalOpen(true);
  };

  return (
    <div className="bg-espresso text-canvas min-h-screen">
      <Nav
        onSignInClick={() => openModal('signin')}
        onRequestAccessClick={() => openModal('signup')}
      />
      <SignInModal isOpen={modalOpen} initialTab={modalTab} onClose={() => setModalOpen(false)} />

      {/* Hero */}
      <section
        className="pt-32 md:pt-40 px-6 md:px-12 pb-20 md:pb-28"
        style={{ background: 'radial-gradient(circle at 80% 0%, rgba(184,147,85,0.12), transparent 55%), #0F0E0D' }}
      >
        <div className="max-w-4xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-6">
              About PropertyDNA
            </div>
            <h1
              className="font-serif font-light text-canvas leading-[1.05] mb-10"
              style={{ fontSize: 'clamp(40px, 6vw, 80px)', letterSpacing: '-1.5px' }}
            >
              We believe data
              <br />
              should tell the <em className="italic text-gold">whole truth.</em>
            </h1>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/70 mb-6">
              PropertyDNA was founded on a simple principle: every property carries a genetic
              fingerprint — a combination of structural, environmental, and market signals that,
              when decoded, reveals its true character and value.
            </p>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/70 mb-6">
              Traditional valuation tools flatten this complexity into a single number and hope for
              the best. We don't. Our platform sequences every attribute that matters, cross-checks
              against 14.3M historical records, and returns a report that any professional can
              defend in front of a committee.
            </p>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/70">
              Built for investors, lenders, and analysts who refuse to guess.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Three values */}
      <section className="bg-[#0A0908] px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            ['Precision', 'Every output is traceable to a verified source. No black boxes.'],
            ['Speed', 'Decisions move at market speed. Our reports arrive in minutes, not weeks.'],
            ['Honesty', 'We tell you when data is thin and when a property is a pass. No sugar coating.'],
          ].map(([title, desc], i) => (
            <FadeUp key={title} delay={i * 0.1}>
              <div>
                <div className="font-serif text-2xl font-light text-gold mb-4">{title}</div>
                <div className="text-[14px] font-light leading-[1.8] text-canvas/60">{desc}</div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-12">By the Numbers</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
              {[
                ['14.3M', 'Properties profiled'],
                ['47',    'Live data sources'],
                ['97.6%', 'Valuation accuracy'],
                ['< 3 min', 'Report delivery'],
              ].map(([num, label], i) => (
                <FadeUp key={label} delay={i * 0.08}>
                  <div className="border-t border-gold/30 pt-5">
                    <div className="font-serif font-light text-canvas mb-2" style={{ fontSize: 'clamp(32px,3.5vw,52px)', letterSpacing: '-1px' }}>
                      {num}
                    </div>
                    <div className="font-sans text-[10px] tracking-[2px] text-canvas/45 uppercase">{label}</div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-[#0A0908] px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-12">Origin Story</div>
          </FadeUp>
          <div className="flex flex-col gap-0">
            {timeline.map(([year, title, desc], i) => (
              <FadeUp key={year} delay={i * 0.08}>
                <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-8 py-8 border-b border-white/8">
                  <div>
                    <div className="font-serif text-2xl font-light text-gold">{year}</div>
                    <div className="font-sans text-[9px] tracking-[2px] text-canvas/40 uppercase mt-1">{title}</div>
                  </div>
                  <div className="font-sans text-[14px] font-light leading-[1.85] text-canvas/65 max-w-2xl">{desc}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Data sources */}
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-4">Data Provenance</div>
            <h2
              className="font-serif font-light text-canvas mb-12"
              style={{ fontSize: 'clamp(28px,3.5vw,48px)', letterSpacing: '-0.8px' }}
            >
              Every source.
              <br />
              <em className="italic text-gold">Fully traceable.</em>
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/6">
            {sources.map(([name, desc], i) => (
              <FadeUp key={name} delay={i * 0.06}>
                <div className="flex items-start gap-6 p-6 bg-espresso">
                  <div className="font-serif text-sm text-gold leading-none mt-0.5 flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div className="font-sans text-[12px] font-medium tracking-[1px] text-canvas mb-1">{name}</div>
                    <div className="font-sans text-[12px] font-light text-canvas/50 leading-[1.6]">{desc}</div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
          <FadeUp delay={0.2}>
            <div className="mt-6 font-sans text-[12px] text-canvas/35 leading-[1.7]">
              Plus 39 additional verified sources covering permit authorities, climate agencies, transit operators, zoning boards, and real estate transaction repositories.
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Founder note */}
      <section className="bg-[#0A0908] px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-8">From the Founder</div>
            <div className="font-serif text-5xl text-gold/30 leading-none mb-6">"</div>
            <p className="font-serif text-[20px] md:text-[24px] font-light italic text-canvas leading-[1.6] mb-10">
              I built PropertyDNA because I kept watching smart people make expensive decisions on
              thin information. Not because they were careless — but because the tools that existed
              gave them a number without showing their work. We show our work.
            </p>
            <div className="border-t border-white/10 pt-6">
              <div className="font-serif text-lg font-light text-canvas mb-1">Daniel Stuart</div>
              <div className="font-sans text-[11px] tracking-[1px] text-canvas/45 uppercase">Founder · PropertyDNA · Stuart Team Real Estate</div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-20 md:py-24 text-center">
        <FadeUp>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-block font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-8 py-4"
            >
              Sequence a Property
            </Link>
            <Link
              to="/how-it-works"
              className="inline-block font-sans text-[11px] font-medium uppercase tracking-[3px] text-canvas border border-canvas/25 hover:border-gold hover:text-gold transition-colors px-8 py-4"
              style={{ textDecoration: 'none' }}
            >
              How It Works →
            </Link>
          </div>
        </FadeUp>
      </section>

      <Footer />
    </div>
  );
}
