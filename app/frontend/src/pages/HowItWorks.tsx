import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import FadeUp from '@/components/FadeUp';
import SignInModal from '@/components/SignInModal';
import PremiumPreviewCard from '@/components/PremiumPreviewCard';
import { Link } from 'react-router-dom';
import { isPremiumUser } from '@/lib/isPremiumUser';

type ModalTab = 'signin' | 'signup' | 'sales';

const steps = [
  ['01', 'INPUT', 'Submit an Address', 'Enter a single property address, upload a CSV of your portfolio, or integrate via our REST API. PropertyDNA accepts any scale of input — one unit or one thousand.'],
  ['02', 'SEQUENCE', 'Deep Data Ingestion', 'Our engine cross-references 47 live data sources and 14.3M historical property records in under 2 seconds. Land registry, planning portals, flood maps, energy ratings, census data — all spliced together into a single timeline.'],
  ['03', 'DECODE', 'Genome Generated', 'A complete property genome emerges: valuation with confidence bands, risk strand analysis, yield potential, comparative position, and trajectory modelling across 5, 10, and 25 year windows.'],
  ['04', 'DEPLOY', 'Act With Confidence', 'You receive a fully formatted intelligence report in your inbox — ready to forward to a committee, a client, or your underwriting team. Make acquisition, disposal, or lending decisions backed by the most complete property intelligence available.'],
];

const dataGroups = [
  {
    group: 'Property & Valuation',
    sources: ['RentCast AVM', 'RentCast Property API', 'Historical transaction records', 'Comparable sales database (14.3M records)'],
  },
  {
    group: 'Risk & Environment',
    sources: ['FEMA National Flood Hazard Layer', 'FEMA Special Flood Hazard Areas', 'NWS Weather & Climate Forecast', 'EPA environmental layers'],
  },
  {
    group: 'Demographics & Economy',
    sources: ['US Census ACS (American Community Survey)', 'Census Bureau Geocoder', 'Bureau of Labor Statistics', 'Local income & employment data'],
  },
  {
    group: 'Safety & Crime',
    sources: ['FBI Uniform Crime Report (UCR)', 'SpotCrime incident-level data', 'Local law enforcement reporting', 'NIBRS national database'],
  },
  {
    group: 'Permits & Development',
    sources: ['BuildZoom permit database', 'Municipal building departments', 'County assessor records', 'Zoning & planning portals'],
  },
  {
    group: 'Intelligence Layer',
    sources: ['Anthropic AI narrative engine', 'Proprietary DNA scoring model', 'Confidence band calculation', 'Would We Buy It? verdict system'],
  },
];

const integrations = [
  ['Manual Entry', 'Submit one address at a time through the web form. No setup required.', false],
  ['CSV Upload', 'Upload a spreadsheet of addresses for batch processing.', true],
  ['REST API', 'Connect PropertyDNA directly to your underwriting or CRM system.', true],
  ['n8n / Zapier', 'Wire PropertyDNA into any automation workflow via webhook.', true],
];

export default function HowItWorks() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab>('signin');
  const premium = isPremiumUser();

  const openModal = (tab: ModalTab = 'signup') => {
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
      <section className="pt-32 md:pt-40 px-6 md:px-12 pb-16">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-6">
              How It Works
            </div>
            <h1
              className="font-serif font-light text-canvas leading-[1.05] mb-10"
              style={{ fontSize: 'clamp(40px, 6vw, 80px)', letterSpacing: '-1.5px' }}
            >
              From address to <em className="italic text-gold">insight</em>
              <br />
              in four steps.
            </h1>
            <p className="font-sans text-[16px] font-light leading-[1.9] text-canvas/70 max-w-2xl">
              Every PropertyDNA report follows the same rigorous pipeline. No shortcuts, no
              estimates — just a sequenced, verifiable profile of the property you care about.
            </p>
          </FadeUp>
        </div>
      </section>

      {/* Four steps */}
      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-5xl mx-auto flex flex-col gap-12 md:gap-16">
          {steps.map(([num, tag, title, desc], i) => (
            <FadeUp key={num} delay={i * 0.08}>
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 md:gap-16 pt-8 border-t border-white/10">
                <div className="flex md:flex-col items-baseline md:items-start gap-4 md:gap-2">
                  <div
                    className="font-serif font-light text-gold leading-none"
                    style={{ fontSize: 'clamp(48px, 5vw, 72px)' }}
                  >
                    {num}
                  </div>
                  <div className="font-sans text-[10px] tracking-[3px] text-canvas/45 uppercase">
                    {tag}
                  </div>
                </div>
                <div>
                  <div className="font-serif text-2xl md:text-3xl font-light text-canvas leading-tight mb-4">
                    {title}
                  </div>
                  <div className="text-[15px] font-light leading-[1.9] text-canvas/65 max-w-xl">
                    {desc}
                  </div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Data sources breakdown */}
      <section className="bg-[#0A0908] px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">Data Architecture</div>
            <h2
              className="font-serif font-light text-canvas mb-14"
              style={{ fontSize: 'clamp(28px,3.5vw,48px)', letterSpacing: '-0.8px' }}
            >
              47 sources.
              <br />
              <em className="italic text-gold">One report.</em>
            </h2>
          </FadeUp>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/6">
            {dataGroups.map((g, i) => (
              <FadeUp key={g.group} delay={i * 0.07}>
                <div className="p-8 bg-[#0A0908] h-full">
                  <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-4">{g.group}</div>
                  <ul className="flex flex-col gap-2.5">
                    {g.sources.map((s) => (
                      <li key={s} className="flex items-start gap-2">
                        <span className="text-gold/60 mt-0.5">—</span>
                        <span className="font-sans text-[13px] font-light text-canvas/60 leading-[1.6]">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery timeline */}
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">Delivery Timeline</div>
            <h2
              className="font-serif font-light text-canvas mb-12"
              style={{ fontSize: 'clamp(28px,3.5vw,48px)', letterSpacing: '-0.8px' }}
            >
              Under <em className="italic text-gold">three minutes,</em>
              <br />
              start to inbox.
            </h2>
          </FadeUp>
          <div className="flex flex-col">
            {[
              ['0:00', 'Form submitted', 'Address, email, and intent captured. DNA sequencing begins.'],
              ['0:02', 'Data ingestion', '47 sources queried in parallel. Property, flood, climate, crime, demographics pulled simultaneously.'],
              ['0:45', 'Genome assembled', 'Raw signals normalized and scored. Valuation confidence bands calculated. Risk strands isolated.'],
              ['1:30', 'Intelligence written', 'AI narrative engine writes buyer, seller, and investment angles grounded in the verified data.'],
              ['2:45', 'Report formatted', 'Full DNA report compiled: vitals, valuation, analysis, comps, risk profile, and verdict.'],
              ['< 3:00', 'Delivered to inbox', 'Secure report link sent to recipient email. Owner copy forwarded to agent/analyst.'],
            ].map(([time, event, desc], i) => (
              <FadeUp key={time} delay={i * 0.06}>
                <div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] gap-6 py-5 border-b border-white/8">
                  <div className="font-serif text-base text-gold leading-tight pt-0.5">{time}</div>
                  <div>
                    <div className="font-sans text-[12px] font-medium tracking-[1px] uppercase text-canvas/80 mb-1">{event}</div>
                    <div className="font-sans text-[13px] font-light text-canvas/50 leading-[1.7]">{desc}</div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Integration options — premium preview */}
      <section className="bg-[#0A0908] px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">Integration Options</div>
            <h2
              className="font-serif font-light text-canvas mb-12"
              style={{ fontSize: 'clamp(28px,3.5vw,48px)', letterSpacing: '-0.8px' }}
            >
              Fits into your
              <br />
              <em className="italic text-gold">existing workflow.</em>
            </h2>
          </FadeUp>
          <div className="flex flex-col gap-0">
            {integrations.map(([method, desc, locked], i) => (
              <FadeUp key={method as string} delay={i * 0.07}>
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-4 items-center py-5 border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <div className="font-sans text-[12px] font-medium tracking-[1px] text-canvas/80">{method as string}</div>
                    {locked && (
                      <span style={{ fontFamily: 'Jost, sans-serif', fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', color: '#B89355', border: '1px solid rgba(184,147,85,0.4)', padding: '2px 6px' }}>Pro</span>
                    )}
                  </div>
                  <div className="font-sans text-[13px] font-light text-canvas/50 leading-[1.7]">{desc as string}</div>
                  {locked ? (
                    <button
                      onClick={() => openModal('signup')}
                      style={{
                        fontFamily: 'Jost, sans-serif', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
                        color: '#B89355', background: 'transparent', border: '1px solid rgba(184,147,85,0.35)',
                        padding: '6px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      Unlock →
                    </button>
                  ) : (
                    <Link
                      to="/"
                      className="font-sans text-[9px] tracking-[2px] uppercase text-canvas/40 hover:text-gold transition-colors"
                      style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >
                      Get Started →
                    </Link>
                  )}
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Premium trend preview */}
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="font-sans text-[10px] tracking-[3px] text-gold uppercase mb-5">Pro Intelligence</div>
            <h2
              className="font-serif font-light text-canvas mb-10"
              style={{ fontSize: 'clamp(28px,3.5vw,48px)', letterSpacing: '-0.8px' }}
            >
              Go beyond the
              <br />
              <em className="italic text-gold">basic valuation.</em>
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <PremiumPreviewCard
              tag="Pro · Comparable Trend Analysis"
              title="Neighborhood Sales Velocity"
              headline="See the Full Property Signal"
              body="Premium unlocks live market movement, comparable trend charts, micro-market heat maps, opportunity scoring, and saved property intelligence."
              ctaLabel="Upgrade Access"
              isPremium={premium}
              revealPct={35}
              onUpgrade={() => openModal('signup')}
              preview={
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, alignItems: 'flex-end', height: 80 }}>
                  {[65,70,62,78,80,75,82,88,79,84,90,87].map((h, i) => (
                    <div key={i} style={{ background: `rgba(184,147,85,${0.3 + h/200})`, height: `${h}%`, minHeight: 4 }} />
                  ))}
                </div>
              }
              style={{ background: '#0A0908' }}
            />
          </FadeUp>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-20 md:py-24 text-center bg-[#0A0908]">
        <FadeUp>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-block font-sans text-[11px] font-medium uppercase tracking-[3px] text-espresso bg-gold hover:bg-[#cfa366] transition-colors px-8 py-4"
            >
              Sequence a Property
            </Link>
            <Link
              to="/professionals"
              className="inline-block font-sans text-[11px] font-medium uppercase tracking-[3px] text-canvas border border-canvas/25 hover:border-gold hover:text-gold transition-colors px-8 py-4"
              style={{ textDecoration: 'none' }}
            >
              For Professionals →
            </Link>
          </div>
        </FadeUp>
      </section>

      <Footer />
    </div>
  );
}
